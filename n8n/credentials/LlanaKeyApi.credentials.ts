import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class LlanaKeyApi implements ICredentialType {
	name = 'llanaKeyApi';

	displayName = 'Llana Key API';

	documentationUrl = 'https://llana.io/endpoints';

	properties: INodeProperties[] = [
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Api Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		}
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				['x-api-key']: '={{$credentials.apiKey}}',
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
