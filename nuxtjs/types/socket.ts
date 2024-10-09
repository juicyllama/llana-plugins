export type SocketData = {
	type: 'INSERT' | 'UPDATE' | 'DELETE'
	[key: string]: string | number
}
