import { defineNuxtPlugin, navigateTo } from '#imports'
import type { FetchError } from 'ofetch'
import { io } from 'socket.io-client'
import type { DeletedResponse, ListResponse, LlanaRequest, SocketData } from './types/index'
import { useCookie } from '#app'

export default defineNuxtPlugin(({ $config }) => {
	const LLANA_INSTANCE_URL = <string>$config.public.LLANA_INSTANCE_URL
	const LLANA_DEBUG = <boolean>Boolean($config.public.LLANA_DEBUG)

	const fetchOptions: any = {
		method: 'GET',
		credentials: 'include', // Added for cookie passing, required for auth and refresh token
		headers: {
			'Content-Type': 'application/json',
		},
	}

	async function refreshToken() {
		let url = LLANA_INSTANCE_URL + '/auth/refresh'
		const result = await (<any>await $fetch(url, { ...fetchOptions, method: 'POST' }))
		debug(`Token refreshed: ${result.access_token.slice(0, 10)}...`)
		return result.access_token
	}

	async function $fetchWithInterceptor(url: string, options: any) {
		try {
			return await $fetch(url, options)
		} catch (e: any) {
			if (e.response?.status === 401) {
				try {
					await refreshToken() // will set a new token cookie
					return await $fetch(url, options)
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
					response = (await $fetchWithInterceptor(
						LLANA_INSTANCE_URL + url,
						<any>fetchOptions,
					)) as ListResponse<T>
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
					response = (await $fetchWithInterceptor(LLANA_INSTANCE_URL + url, {
						...fetchOptions,
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
					response = (await $fetchWithInterceptor(LLANA_INSTANCE_URL + url, {
						...fetchOptions,
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
					response = (await $fetchWithInterceptor(LLANA_INSTANCE_URL + url, {
						fetchOptions,
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
					response = (await $fetchWithInterceptor(LLANA_INSTANCE_URL + url, {
						...fetchOptions,
						method: 'GET',
					})) as T
				} catch (e) {
					handleResponseError(e)
				}

				break

			default:
				throw new Error('Invalid request type')
		}

		debug(response)
		return response
	}

	async function Login(creds: { username: string; password: string }): Promise<{
		access_token?: string
		error?: any
		status: number
	}> {
		try {
			debug(`Running Llana Request: '/auth/login'`)

			const response = <any>await $fetch(LLANA_INSTANCE_URL + '/auth/login', {
				...fetchOptions,
				method: 'POST',
				body: creds,
			})
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
		let isManuallyDisconnected = false
		if (!table) {
			throw new Error('No table provided for subscription')
		}

		debug(`Setting up WS Subscription for ${table}`)

		const token = await refreshToken()

		const socket = io(LLANA_INSTANCE_URL, {
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
						const newToken = await refreshToken()
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

			let url = LLANA_INSTANCE_URL + '/auth/profile'

			if (options?.relations) {
				url += `?relations=${options.relations.join(',')}`
			}

			const result = <T>await (<any>await $fetchWithInterceptor(url, fetchOptions))

			debug(result)

			return result
		} catch (e: any) {
			handleResponseError(e)
		}
	}

	async function Logout(): Promise<void> {
		debug(`Llana Logging out`)
		let url = LLANA_INSTANCE_URL + '/auth/logout'
		await (<any>await $fetch(url, { ...fetchOptions, method: 'POST' }))
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
		const isLlanaLoggedIn = useCookie('isLlanaLoggedIn')?.value
		return !!isLlanaLoggedIn
	}

	function debug(msg: string, props?: any) {
		if (LLANA_DEBUG) {
			if (typeof msg === 'object') {
				console.log('[LANA]', msg)
			} else {
				console.log('[LANA]' + msg, props)
			}
		}
	}

	return {
		provide: {
			llana: run,
			llanaLogin: Login,
			llanaLogout: Logout,
			llanaGetProfile: GetProfile,
			llanaSubscribe: Subscribe,
			llanaInstanceUrl: LLANA_INSTANCE_URL,
			llanaAuthCheck: AuthCheck,
			llanaAccessToken: refreshToken,
		},
	}
})
