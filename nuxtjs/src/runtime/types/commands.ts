import type { LlanaRequestType } from './index'

export type Where = {
	field: string
	operator: string
	value: string | number
}

export type LlanaRequest<T> = {
  type: LlanaRequestType
  table: string
  id?: string | number
  fields?: string[]
  data?: T | Partial<T>
  relations?: string
  where?: Where[]
  limit?: number
  offset?: number
  page?: string
  sort?: string
  hard?: boolean
}
