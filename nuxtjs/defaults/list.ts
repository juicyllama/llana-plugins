import type { ListResponse } from '../types'

export function defaultList<T>(): ListResponse<T> {
	return {
		limit: 0,
		offset: 0,
		total: 0,
		pagination: {
			total: 0,
			page: {
				current: '',
				prev: '',
				next: '',
				first: '',
				last: '',
			},
		},
		data: [],
	}
}
