import { LLANA_INSTANCE_URL, LLANA_TOKEN_KEY } from '.'

export async function Login(creds: { username: string; password: string }): Promise<{
	access_token?: string
	error?: any
	status: number
}> {
	try {
		const fetchConfig = {
			method: 'POST',
			body: creds,
		}

		//TODO: type the response

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

export async function GetProfile<T>(): Promise<T | undefined> {
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
		if (e.response.status === 401) {
			Logout()
		} else {
			console.error(e)
		}
	}
}

export function Logout(): void {
	useCookie<Partial<undefined>>(LLANA_TOKEN_KEY).value = undefined
	navigateTo('/login', { replace: true })
}
