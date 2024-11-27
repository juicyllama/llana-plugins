import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class LlanaApiKey implements ICredentialType {
	name = 'llanaApiKey';

	displayName = 'Llana API Key';

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
