export type { Where } from './commands'
export type { ErrorResponse } from './error'

export type LlanaRequestType = 'LIST' | 'GET' | 'CREATE' | 'UPDATE' | 'DELETE'

export type ListResponse<T> = {
	limit: number
	offset: number
	total: number
	pagination: {
		total: number
		page: {
			current: string
			prev: string
			next: string
			first: string
			last: string
		}
	}
	data: T[]
}

export type DeletedResponse = {
	deleted: number
}
