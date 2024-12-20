import { io } from 'socket.io-client'
import type { DeletedResponse, ListResponse, LlanaRequestType, Where, SocketData } from './types/index'
import { defineNuxtPlugin, useCookie, navigateTo } from '#imports'
import type { FetchError } from 'ofetch'

export default defineNuxtPlugin(({ $config }) => {
	const LLANA_INSTANCE_URL = <string>$config.public.LLANA_INSTANCE_URL
	const LLANA_DEBUG = <boolean>Boolean($config.public.LLANA_DEBUG)
	const LLANA_TOKEN_KEY = 'llana_access_token'

	async function run<T>(options: {
		type: LlanaRequestType
		table: string
		id?: string | number
		data?: T | Partial<T>
		relations?: string
		where?: Where[]
		limit?: number
		offset?: number
		page?: string
		sort?: string
	}): Promise<ListResponse<T> | T | DeletedResponse> {
		let url: string
		const fetchOptions: any = {
			method: 'GET',
			headers: {
				Authorization: 'Bearer ' + getToken(),
				'Content-Type': 'application/json',
			},
		}

		let response: any

		switch (options.type) {
			case 'LIST':
				url = `/${options.table}/?`

				if (options.relations && options.relations != null) {
					url += `relations=${options.relations}&`
				}

				if (options.where && options.where.length) {
					for (const w of options.where) {
						url += `${w.field}[${w.operator}]=${w.value}&`
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

				if (LLANA_DEBUG) console.log(`Running Llana Request: ${options.type} ${options.table} ${url}`)

				try{
					response = (await $fetch(LLANA_INSTANCE_URL + url, <any>fetchOptions)) as ListResponse<T>
				}catch(e){
					handleResponseError(e)
				}

				break

			case 'CREATE':
				url = `/${options.table}/`

				if (!options.data) {
					throw new Error('No data provided for create')
				}

				fetchOptions.method = 'POST'
				fetchOptions.body = JSON.stringify(options.data)

				if (LLANA_DEBUG) console.log(`Running Llana Request: ${options.type} ${options.table} ${url}`)

				try{
					response = (await $fetch(LLANA_INSTANCE_URL + url, <any>fetchOptions)) as T
				} catch(e){
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

				fetchOptions.method = 'PUT'
				fetchOptions.body = JSON.stringify(options.data)

				if (LLANA_DEBUG) console.log(`Running Llana Request: ${options.type} ${options.table} ${url}`)

				try{
					response = (await $fetch(LLANA_INSTANCE_URL + url, <any>fetchOptions)) as T
				} catch(e){
					handleResponseError(e)
				}

				break

			case 'DELETE':
				if (!options.id) {
					throw new Error('No ID provided for delete')
				}

				url = `/${options.table}/${options.id}`

				fetchOptions.method = 'DELETE'

				if (LLANA_DEBUG) console.log(`Running Llana Request: ${options.type} ${options.table} ${url}`)

				try{
					response = (await $fetch(LLANA_INSTANCE_URL + url, <any>fetchOptions)) as DeletedResponse
				} catch(e){
					handleResponseError(e)
				}

				break

			case 'GET':
				if (!options.id) {
					throw new Error('No ID provided for get')
				}

				url = `/${options.table}/${options.id}?`

				if (options.relations && options.relations != null) {
					url += `relations=${options.relations}&`
				}

				fetchOptions.method = 'GET'

				if (LLANA_DEBUG) console.log(`Running Llana Request: ${options.type} ${options.table} ${url}`)

				try{
					response = (await $fetch(LLANA_INSTANCE_URL + url, <any>fetchOptions)) as T
				} catch(e){
					handleResponseError(e)
				}

				break

			default:
				throw new Error('Invalid request type')
		}

		if (LLANA_DEBUG) console.dir(response)
		return response

	}

	async function Login(creds: { username: string; password: string }): Promise<{
		access_token?: string
		error?: any
		status: number
	}> {
		try {
			const fetchConfig = {
				method: 'POST',
				body: creds,
			}

			if (LLANA_DEBUG) console.log(`Running Llana Request: '/auth/login'`)

			const response = <any>await $fetch(LLANA_INSTANCE_URL + '/auth/login', <any>fetchConfig)

			setToken(response.access_token)

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

	async function Subscribe(
		table: string,
		callbackInsert?: Function,
		callbackUpdate?: Function,
		callbackDelete?: Function,
	): Promise<void> {
		if (!table) {
			throw new Error('No table provided for subscription')
		}

		if (LLANA_DEBUG) console.log(`Setting up WS Subscription for ${table}`)

		const socket = io(LLANA_INSTANCE_URL, {
			reconnection: true,
			extraHeaders: {
				Authorization: 'Bearer ' + getToken(),
				'x-llana-table': table,
			},
			auth: {
				token: getToken(),
			},
		})

		try {
			socket.on('connect', () => {
				if (LLANA_DEBUG) console.log(`Subscribed to Llana Instance ${table}: ${socket.id}`)
			})
			socket.on(table, (data: SocketData) => {
				if (LLANA_DEBUG)
					console.log(`New WS Message: ${socket.id}`, {
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
			socket.on('disconnect', () => {
				if (LLANA_DEBUG) console.log(`Unsubscribed to Llana Instance ${table}: ${socket.id}`)
			})
		} catch (e: any) {
			console.error(e)
			socket.off(table)
		}
	}

	/**
	 * Gets the users profile
	 */

	async function GetProfile<T>(options?: {
    relations?: string[],
  }): Promise<T | undefined> {
		try {
			const fetchConfig = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer ' + getToken(),
				},
			}

			if (LLANA_DEBUG) console.log(`Running Llana Request: '/auth/profile'`)

      let url = LLANA_INSTANCE_URL + '/auth/profile'

      if(options?.relations){
        url += `?relations=${options.relations.join(',')}`
      }

			const result = <T>await (<any>await $fetch(url, <any>fetchConfig))

      		if (LLANA_DEBUG) console.dir(result)

        	return result

		} catch (e: any) {
			handleResponseError(e)
		}
	}

	function Logout(): void {
		if (LLANA_DEBUG) console.log(`Llana Logging out`)
		setToken(undefined)
		navigateTo('/login', { replace: true })
	}

	function getToken(): string | null {
		return useCookie<Partial<string>>(LLANA_TOKEN_KEY).value
	}

	function setToken(token?: string | undefined): void {
		useCookie<Partial<string | undefined>>(LLANA_TOKEN_KEY, {
			sameSite: 'strict',
		}).value = token
	}

	function handleResponseError(e: any){
		console.error(e)

		if (e.response?.status === 401 || e.response?.status === 403) {
			Logout()
		}

		throw (e as FetchError)
	}

	async function AuthCheck(): Promise<boolean> {
		if (!getToken()) {
			return false
		}else{
			try{
				const profile = await GetProfile()
				if(!profile){
					return false
				}
			}catch(e){
				return false
			}
		}
		return true
	}

	return {
		provide: {
			llana: run,
			llanaLogin: Login,
			llanaLogout: Logout,
			llanaGetProfile: GetProfile,
			llanaSubscribe: Subscribe,
			llanaInstanceUrl: LLANA_INSTANCE_URL,
			llanaAccessToken: getToken(),
			llanaAuthCheck: AuthCheck,
		},
	}
})
