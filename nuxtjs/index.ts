import { defineNuxtPlugin } from '#app';
import type { DeletedResponse, ListResponse, LlanaRequestType, Where } from './types/index'

export type { ListResponse, ErrorResponse, Where } from './types/index'
export { defaultList } from './defaults/index'

export default defineNuxtPlugin(({ $config }) => {

	const LLANA_INSTANCE_URL = $config.public.LLANA_INSTANCE_URL
	const LLANA_TOKEN_KEY = '_llana_access_token'

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
		let fetchOptions = {
			method: 'GET',
			headers: {
				Authorization: 'Bearer ' + useCookie<Partial<string>>(LLANA_TOKEN_KEY).value,
				'Content-Type': 'application/json',
			}
		}
	
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
	
				return (await $fetch(LLANA_INSTANCE_URL + url, <any>fetchOptions)) as ListResponse<T>
	
			case 'CREATE':
				url = `/${options.table}/`
	
				if (!options.data) {
					throw new Error('No data provided for create')
				}
	
				fetchOptions.method = 'POST'
				fetchOptions.body = JSON.stringify(options.data)
	
				return (await $fetch(LLANA_INSTANCE_URL + url, <any>fetchOptions)) as T
	
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
				return (await $fetch(LLANA_INSTANCE_URL + url, <any>fetchOptions)) as T
	
			case 'DELETE':
				if (!options.id) {
					throw new Error('No ID provided for delete')
				}
	
				url = `/${options.table}/${options.id}`
	
				fetchOptions.method = 'DELETE'
				return (await $fetch(LLANA_INSTANCE_URL + url, <any>fetchOptions)) as DeletedResponse
	
			case 'GET':
				if (!options.id) {
					throw new Error('No ID provided for get')
				}
	
				url = `/${options.table}/${options.id}`
	
				fetchOptions.method = 'GET'
				return (await $fetch(LLANA_INSTANCE_URL + url, <any>fetchOptions)) as T
	
			default:
				throw new Error('Invalid request type')
		}
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
	
			const response = <any>await $fetch(LLANA_INSTANCE_URL + '/auth/login', <any>fetchConfig)
	
			useCookie<Partial<string>>(LLANA_TOKEN_KEY).value = response.access_token
	
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
	
	/**
	 * Gets the users profile
	 */
	
	async function GetProfile<T>(): Promise<T | undefined> {
		try {
	
			const fetchConfig = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer ' + useCookie<string>(LLANA_TOKEN_KEY).value,
				},
			}
	
			return <T>await <any>await $fetch(LLANA_INSTANCE_URL + '/auth/profile', <any>fetchConfig)
		} catch (e: any) {
			if (e.response?.status === 401) {
				Logout()
			} else {
				console.error(e)
			}
		}
	}
	
	function Logout(): void {
		useCookie<Partial<undefined>>(LLANA_TOKEN_KEY).value = undefined
		navigateTo('/login', { replace: true })
	}
	

	return {
		provide: {
			llana: run,
			llanaLogin: Login,
			llanaLogout: Logout,
			llanaGetProfile: GetProfile,
			llanaInstanceUrl: LLANA_INSTANCE_URL,
			llanaAccessToken: useCookie<Partial<string>>(LLANA_TOKEN_KEY).value,
		}
	  }
})
