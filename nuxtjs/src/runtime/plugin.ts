import { defineNuxtPlugin, navigateTo, useCookie } from '#app'
import type { FetchError } from 'ofetch'
import { io } from 'socket.io-client'
import type { DeletedResponse, ListResponse, LlanaRequest, SocketData } from './types/index'

const IS_LOGGED_IN_COOKIE_NAME = 'isLlanaLoggedIn'
const ACCESS_TOKEN_COOKIE_NAME = 'accessToken'

export default defineNuxtPlugin(({ $config }) => {
	const LLANA_INSTANCE_URL = <string>$config.public.LLANA_INSTANCE_URL
	const NUXT_URL = <string>$config.public.NUXT_URL
	const LLANA_DEBUG = <boolean>Boolean($config.public.LLANA_DEBUG)
	const API_URL = NUXT_URL ? `${NUXT_URL}/api` : LLANA_INSTANCE_URL

	const getFetchOptions = () => {
		const opts = {
			method: 'GET',
			credentials: 'include', // Added for cookie passing, required for auth and refresh token
			headers: {
				'Content-Type': 'application/json',
				...useRequestHeaders(['cookie']),
			},
		}
		return opts
	}

	async function refreshToken() {
		debug('Llana Plugin: Refreshing token')

		const url = API_URL + '/auth/refresh'
		const { access_token, expires_in, refresh_token_expires_in } = await (<any>(
			await $fetch(url, { ...getFetchOptions(), method: 'POST' })
		))
		useCookie(IS_LOGGED_IN_COOKIE_NAME, { maxAge: refresh_token_expires_in }).value = 'true'
		useCookie(ACCESS_TOKEN_COOKIE_NAME, { maxAge: expires_in }).value = access_token

		debug(`Token refreshed: ${access_token.slice(0, 10)}...`)
		return access_token
	}

	async function $fetchWithInterceptor(url: string, options: any) {
		debug('Llana Plugin: fetching', url)
		try {
			const res = await $fetch(url, options)
			// syncCookiesFromResponse(res)
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
							Authorization: `Bearer ${access_token}`,
						},
					}
					debug('Retrying with new token', access_token.slice(0, 10) + '...')
					return await $fetch(url, updatedOptions)
				} catch (refreshError) {
					handleResponseError(refreshError)
				}
			} else {
				handleResponseError(e)
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
					handleResponseError(e)
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
					handleResponseError(e)
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
					handleResponseError(e)
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
					handleResponseError(e)
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
					handleResponseError(e)
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
				body: creds,
			})

			useCookie(IS_LOGGED_IN_COOKIE_NAME, { maxAge: response.refresh_token_expires_in }).value = 'true'

			return {
				access_token: response.access_token,
				status: 'status' in response ? response?.status : 200,
			}
		} catch (e: any) {
			return {
				error: e,
				status: e.response.status,
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
			const url = API_URL + '/auth/refresh'
			const { access_token } = await fetch(url, { ...getFetchOptions(), method: 'POST' }).then(res => res.json())
			debug(`[WebSocket] token fetched: ${access_token.slice(0, 10)}...`)
			return access_token
		}

		debug(`Setting up WS Subscription for ${table}`)

		const token = await getAccessToken()

		const socket = io(API_URL, {
			auth: {
				token: `Bearer ${token}`,
				'x-llana-table': table,
			},
			reconnection: true,
			reconnectionDelay: 2000, // Start with 2s delay
			reconnectionDelayMax: 15000, // Increase delay up to 15s
			reconnectionAttempts: Infinity, // Retry indefinitely
			autoConnect: false, // Avoid auto-connect issues,
			transports: ['websocket'], // Disable polling
		})

		let reconnectTimer: NodeJS.Timeout | null = null

		function attemptReconnect() {
			if (reconnectTimer) clearTimeout(reconnectTimer)

			reconnectTimer = setTimeout(() => {
				if (socket && !socket.connected) {
					debug(`[WebSocket] Attempting to reconnect...`)
					socket.connect()
				}
			}, 5000)
		}

		try {
			socket.on('connect', () => {
				debug(`Subscribed to Llana Instance ${table}: ${socket.id}`)
				isManuallyDisconnected = false
			})
			socket.on(table, (data: SocketData) => {
				debug(`New WS Message: ${socket.id}`, {
					table,
					...data,
				})
				switch (data.type) {
					case 'INSERT':
						callbackInsert ? callbackInsert(data) : null
						break
					case 'UPDATE':
						callbackUpdate ? callbackUpdate(data) : null
						break
					case 'DELETE':
						callbackDelete ? callbackDelete(data) : null
						break
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

				if (error.message === 'Token error') {
					try {
						const newToken = await getAccessToken()
						socket!.io.opts.auth.token = `Bearer ${newToken}`
						debug(`[WebSocket] Reconnecting with new token`)
						socket!.connect()
					} catch (tokenError: any) {
						debug(`[WebSocket] Failed to refresh token: ${tokenError.message}`)
					}
				}
			})

			socket.on('error', error => {
				debug(`[WebSocket] Error: ${error.message}`)
			})
			socket.connect()

			return () => {
				isManuallyDisconnected = true
				socket.close()
			}
		} catch (e: any) {
			console.error(e)
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
			handleResponseError(e)
		}
	}

	async function Logout(): Promise<void> {
		debug(`Llana Logging out`)
		const url = API_URL + '/auth/logout'
		await (<any>await $fetch(url, { ...getFetchOptions(), method: 'POST' }))
		useCookie(IS_LOGGED_IN_COOKIE_NAME).value = undefined
		navigateTo('/login', { replace: true })
	}

	function handleResponseError(e: any) {
		console.error(e)

		if (e.response?.status === 401 || e.response?.status === 403) {
			Logout()
		}

		throw e as FetchError
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
			// llanaGetAccessToken: getAccessToken,
		},
	}
})
