import { defineNuxtPlugin, navigateTo, useCookie, useRequestHeaders } from '#app'
import { io } from 'socket.io-client'
import type { DeletedResponse, ListResponse, LlanaRequest, SocketData } from './types/index'

const IS_LOGGED_IN_COOKIE_NAME = 'isLlanaLoggedIn'

export default defineNuxtPlugin(({ $config }) => {
	const LLANA_INSTANCE_URL = <string>$config.public.LLANA_INSTANCE_URL
	const API_URL = <string>$config.public.LLANA_INSTANCE_PROXY_URL || LLANA_INSTANCE_URL
	const LLANA_DEBUG = <boolean>Boolean($config.public.LLANA_DEBUG)

	// Add a refresh token lock to prevent multiple concurrent refresh attempts
	let isRefreshing = false
	let refreshPromise: Promise<string> | null = null

	const getFetchOptions = () => {
		const opts = {
			method: 'GET',
			credentials: 'include', // Added for cookie passing, required for auth and refresh token
			headers: {
				'Content-Type': 'application/json',
				...useRequestHeaders(), // Pass auth cookies from the request headers
			},
		}
		return opts
	}

	async function refreshToken() {
		debug('Refreshing token')

		// Implement token refresh lock to prevent multiple concurrent requests
		if (isRefreshing) {
			debug('Token refresh already in progress, waiting...')
			return refreshPromise as Promise<string>
		}

		isRefreshing = true
		refreshPromise = (async () => {
			try {
				const url = API_URL + '/auth/refresh'
				const response = await $fetch(url, { ...getFetchOptions(), method: 'POST' })

				if (!response) {
					throw new Error('No response from refresh token endpoint')
				}

				const { access_token, refresh_token_expires_in } = response as any

				if (!access_token) {
					throw new Error('No access token in refresh response')
				}

				// Set cookies with proper expiration
				useCookie(IS_LOGGED_IN_COOKIE_NAME, { maxAge: refresh_token_expires_in }).value = 'true'

				debug(`Token refreshed: ${access_token.slice(0, 10)}...`)
				return access_token
			} catch (error) {
				debug('Token refresh failed', error)
				// Clear cookies on refresh failure
				useCookie(IS_LOGGED_IN_COOKIE_NAME).value = undefined
				throw error
			} finally {
				isRefreshing = false
				refreshPromise = null
			}
		})()

		return refreshPromise
	}

	async function $fetchWithInterceptor(url: string, options: any) {
		debug('Fetching ' + url)
		try {
			const res = await $fetch(url, options)
			return res
		} catch (e: any) {
			if (e.response?.status === 401) {
				try {
					const access_token = await refreshToken() // will set a new token cookie
					// Update options with the new token
					const updatedOptions = {
						...options,
						headers: {
							...options.headers,
							cookie: undefined, // Remove the old auth cookie header in favor of the new Bearer token
							Authorization: `Bearer ${access_token}`,
						},
					}
					debug('Retrying with new token:' + access_token.slice(0, 10) + '...')
					return await $fetch(url, updatedOptions)
				} catch (refreshError) {
					debug('Failed to refresh token', refreshError)
					throw e
				}
			} else {
				throw e
			}
		}
	}

	async function run<T>(options: LlanaRequest<T>): Promise<ListResponse<T> | T | DeletedResponse> {
		let url: string
		let response: any
		const currentFetchOptions = getFetchOptions()

		switch (options.type) {
			case 'LIST':
				url = `/${options.table}/?`

				if (options.fields && options.fields.length) {
					url += `fields=${options.fields.join(',')}&`
				}

				if (options.relations && options.relations != null) {
					url += `relations=${options.relations}&`
				}

				if (options.where && options.where.length) {
					for (const w of options.where) {
						if (w.operator) {
							url += `${w.field}[${w.operator}]=${w.value}&`
						} else {
							url += `${w.field}=${w.value}&`
						}
					}
				}

				if (options.limit && options.limit != null) {
					url += `limit=${options.limit}&`
				}

				if (options.offset && options.offset != null) {
					url += `offset=${options.offset}&`
				}

				if (options.page && options.page != null) {
					url += `page=${options.page}&`
				}

				if (options.sort && options.sort != null) {
					url += `sort=${options.sort}&`
				}

				url = url.slice(0, -1)

				debug(`Running Llana Request: ${options.type} ${options.table} ${url}`)

				try {
					response = (await $fetchWithInterceptor(API_URL + url, <any>currentFetchOptions)) as ListResponse<T>
				} catch (e) {
					throw handleResponseError(e)
				}

				break

			case 'CREATE':
				url = `/${options.table}/`

				if (!options.data) {
					throw new Error('No data provided for create')
				}
				debug(`Running Llana Request: ${options.type} ${options.table} ${url}`)

				try {
					response = (await $fetchWithInterceptor(API_URL + url, {
						...currentFetchOptions,
						method: 'POST',
						body: JSON.stringify(options.data),
					})) as T
				} catch (e) {
					throw handleResponseError(e)
				}

				break

			case 'UPDATE':
				if (!options.data) {
					throw new Error('No data provided for create')
				}

				if (!options.id) {
					throw new Error('No ID provided for update')
				}

				url = `/${options.table}/${options.id}`

				debug(`Running Llana Request: ${options.type} ${options.table} ${url}`)

				try {
					response = (await $fetchWithInterceptor(API_URL + url, {
						...currentFetchOptions,
						method: 'PUT',
						body: JSON.stringify(options.data),
					})) as T
				} catch (e) {
					throw handleResponseError(e)
				}

				break

			case 'DELETE':
				if (!options.id) {
					throw new Error('No ID provided for delete')
				}

				url = `/${options.table}/${options.id}`

				if (options.hard) {
					url += '?hard=true'
				}
				debug(`Running Llana Request: ${options.type} ${options.table} ${url}`)

				try {
					response = (await $fetchWithInterceptor(API_URL + url, {
						...currentFetchOptions,
						method: 'DELETE',
					})) as DeletedResponse
				} catch (e) {
					throw handleResponseError(e)
				}

				break

			case 'GET':
				if (!options.id) {
					throw new Error('No ID provided for get')
				}

				url = `/${options.table}/${options.id}?`

				if (options.fields && options.fields.length) {
					url += `fields=${options.fields.join(',')}&`
				}

				if (options.relations && options.relations != null) {
					url += `relations=${options.relations}&`
				}

				debug(`Running Llana Request: ${options.type} ${options.table} ${url}`)

				try {
					response = (await $fetchWithInterceptor(API_URL + url, {
						...currentFetchOptions,
						method: 'GET',
					})) as T
				} catch (e) {
					throw handleResponseError(e)
				}

				break

			default:
				throw new Error('Invalid request type')
		}

		return response
	}

	async function Login(creds: { username: string; password: string }): Promise<{
		access_token?: string
		error?: any
		status: number
	}> {
		try {
			debug(`Running Llana Request: '/auth/login'`)

			const response = <any>await $fetch(API_URL + '/auth/login', {
				...getFetchOptions(),
				method: 'POST',
				body: JSON.stringify(creds), // Ensure body is properly serialized
			})

			if (!response || !response.access_token) {
				throw new Error('Invalid login response')
			}

			useCookie(IS_LOGGED_IN_COOKIE_NAME, { maxAge: response.refresh_token_expires_in }).value = 'true'

			return {
				access_token: response.access_token,
				status: 'status' in response ? response?.status : 200,
			}
		} catch (e: any) {
			debug('Login error:', e)
			return {
				error: e,
				status: e.response?.status || 500,
			}
		}
	}

	// Subscribe to a table. Returns a function to unsubscribe and close the socket
	async function Subscribe(
		table: string,
		callbackInsert?: Function,
		callbackUpdate?: Function,
		callbackDelete?: Function,
	): Promise<() => void> {
		if (process.server) {
			debug('[WebSocket] Subscribe is not available on server side')
			return () => {}
		}

		let isManuallyDisconnected = false
		if (!table) {
			throw new Error('No table provided for subscription')
		}

		async function getAccessToken() {
			try {
				return await refreshToken()
			} catch (error) {
				debug(`[WebSocket] Failed to get access token: ${error}`)
				throw error
			}
		}

		debug(`[WebSocket] Setting up WS Subscription for ${table}`)

		let token
		try {
			token = await getAccessToken()
		} catch (error) {
			debug('[WebSocket] Could not initialize subscription due to auth error')
			throw error
		}

		const socket = io(LLANA_INSTANCE_URL, {
			auth: {
				token: `Bearer ${token}`,
				'x-llana-table': table,
			},
			reconnection: true,
			reconnectionDelay: 2000,
			reconnectionDelayMax: 15000,
			reconnectionAttempts: Infinity,
			autoConnect: false,
			transports: ['websocket'],
			timeout: 10000, // Add a connection timeout
		})

		let reconnectTimer: NodeJS.Timeout | null = null
		let reconnectAttempts = 0
		const MAX_RECONNECT_ATTEMPTS = 30

		function attemptReconnect() {
			if (reconnectTimer) clearTimeout(reconnectTimer)

			if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
				debug(`[WebSocket] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached.`)
				return
			}

			reconnectTimer = setTimeout(async () => {
				if (socket && !socket.connected && !isManuallyDisconnected) {
					reconnectAttempts++
					debug(`[WebSocket] Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`)

					// Try to get a fresh token before reconnecting
					try {
						const newToken = await getAccessToken()
						socket!.io.opts.auth.token = `Bearer ${newToken}`
					} catch (error) {
						debug('[WebSocket] Failed to refresh token for reconnection')
					}

					socket.connect()
				}
			}, 5000 * Math.min(reconnectAttempts + 1, 5)) // Exponential backoff, max 25s
		}

		try {
			socket.on('connect', () => {
				debug(`[WebSocket] Subscribed to Llana Instance ${table}: ${socket.id}`)
				isManuallyDisconnected = false
				reconnectAttempts = 0 // Reset counter on successful connection
			})

			socket.on(table, (data: SocketData) => {
				debug(`[WebSocket] New WS Message: ${socket.id}`, {
					table,
					...data,
				})
				try {
					switch (data.type) {
						case 'INSERT':
							if (callbackInsert) callbackInsert(data)
							break
						case 'UPDATE':
							if (callbackUpdate) callbackUpdate(data)
							break
						case 'DELETE':
							if (callbackDelete) callbackDelete(data)
							break
					}
				} catch (error) {
					debug(`[WebSocket] Error in callback: ${error}`)
				}
			})

			socket.on('disconnect', reason => {
				debug(`[WebSocket] Disconnected: ${reason}. Attempting reconnect...`)
				if (!isManuallyDisconnected) {
					attemptReconnect()
				}
			})

			socket.on('connect_error', async error => {
				debug(`[WebSocket] Connection error: ${error.message}`)

				if (error.message?.includes('Token') || error.message?.includes('Authentication')) {
					try {
						const newToken = await getAccessToken()
						socket!.io.opts.auth.token = `Bearer ${newToken}`
						debug(`[WebSocket] Reconnecting with new token`)
						socket.connect()
					} catch (tokenError: any) {
						debug(`[WebSocket] Failed to refresh token: ${tokenError.message}`)
					}
				} else {
					attemptReconnect()
				}
			})

			socket.on('error', error => {
				debug(`[WebSocket] Error: ${error.message}`)
			})

			socket.connect()

			return () => {
				debug('[WebSocket] Manually closing connection')
				isManuallyDisconnected = true
				if (reconnectTimer) clearTimeout(reconnectTimer)
				socket.disconnect()
				socket.close()
			}
		} catch (e: any) {
			console.error('[WebSocket] Fatal error:', e)
			socket.close()
			throw e
		}
	}

	/**
	 * Gets the users profile
	 */

	async function GetProfile<T>(options?: { relations?: string[] }): Promise<T | undefined> {
		try {
			debug(`Running Llana Request: '/auth/profile'`)

			let url = API_URL + '/auth/profile'

			if (options?.relations) {
				url += `?relations=${options.relations.join(',')}`
			}

			const result = <T>await (<any>await $fetchWithInterceptor(url, getFetchOptions()))

			return result
		} catch (e: any) {
			throw handleResponseError(e)
		}
	}

	async function Logout(): Promise<void> {
		debug(`Logging out`)
		const url = API_URL + '/auth/logout'
		await (<any>await $fetch(url, { ...getFetchOptions(), method: 'POST' }))
		useCookie(IS_LOGGED_IN_COOKIE_NAME).value = undefined
		navigateTo('/login', { replace: true })
	}

	function handleResponseError(e: any) {
		debug('API error:', e)

		if (e.response?.status === 401 || e.response?.status === 403) {
			// Don't call Logout directly from here to avoid recursion - just reset cookies
			useCookie(IS_LOGGED_IN_COOKIE_NAME).value = undefined

			// Use setTimeout to avoid immediate navigation during an ongoing request
			setTimeout(() => {
				navigateTo('/login', { replace: true })
			}, 0)
		}

		return e // Return instead of throwing to fix handler pattern
	}

	function AuthCheck(): boolean {
		const isLlanaLoggedIn = !!useCookie(IS_LOGGED_IN_COOKIE_NAME).value
		debug('AuthCheck:', isLlanaLoggedIn)
		return isLlanaLoggedIn
	}

	function debug(...args: any[]) {
		if (LLANA_DEBUG) {
			args[0] = '[LLANA] ' + args[0]
			console.log(...args)
		}
	}

	return {
		provide: {
			llana: run,
			llanaLogin: Login,
			llanaLogout: Logout,
			llanaGetProfile: GetProfile,
			llanaSubscribe: Subscribe,
			llanaInstanceUrl: API_URL,
			llanaAuthCheck: AuthCheck,
			llanaAccessToken: refreshToken,
		},
	}
})
