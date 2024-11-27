import type {
	IAuthenticateGeneric,
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestHelper,
	INodeProperties,
} from 'n8n-workflow';

export class LlanaAuthApi implements ICredentialType {
	name = 'llanaAuthApi';

	displayName = 'Llana Username and Password API';

	documentationUrl = 'https://llana.io/endpoints';

	icon: 'file:llana.png',

	properties: INodeProperties[] = [
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
		{
			displayName: 'sessionToken',
			name: 'sessionToken',
			type: 'hidden',
			typeOptions: {
				expirable: true,
				password: true,
			},
			default: '',
		},
	];

	async preAuthentication(this: IHttpRequestHelper, credentials: ICredentialDataDecryptedObject) {
		const { host, username, password } = credentials;
		const result = await this.helpers.httpRequest({
			method: 'POST',
			url: `${host}/auth/login`,
			body: {
				username,
				password
			},
			headers: {
				'Content-Type': 'application/json',
			},
		});

		const { access_token } = result.data;

		return { sessionToken: access_token };
	}

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.sessionToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials?.host}}',
			url: '/auth/profile',
		},
	};
}
