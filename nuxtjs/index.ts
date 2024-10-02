import { LLANA_INSTANCE_URL as llana_config_url } from './llana.config'
import type { DeletedResponse, ListResponse, LlanaRequestType, Where } from './types/index'

export type { ListResponse, ErrorResponse, Where } from './types/index'
export { defaultList } from './defaults/index'
export { GetProfile, Login, Logout } from './auth'

export const LLANA_TOKEN_KEY = '_llana_access_token'
export const LLANA_INSTANCE_URL = llana_config_url

export async function $llana<T>(options: {
	type: LlanaRequestType
	table: string
	id?: string
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
			Authorization: 'Bearer ' + GetAccessToken(),
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

export function GetAccessToken(): string {
	return useCookie<string>(LLANA_TOKEN_KEY).value
}

export default defineNuxtPlugin(() => {})
