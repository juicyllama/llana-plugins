import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class LlanaHostApi implements ICredentialType {
	name = 'llanaHostApi';

	displayName = 'Llana Host API';

	iconUrl = {
		dark: 'file:llana.png',
		light: 'file:llana.png',
	};

	documentationUrl = 'https://llana.io/endpoints';

	properties: INodeProperties[] = [
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: '',
		}
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials?.host}}',
			url: '/tables',
		},
	};
}
