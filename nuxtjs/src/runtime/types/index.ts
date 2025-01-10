export * from './commands'
export * from './error'
export * from './socket'
export * from './nuxt'

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
