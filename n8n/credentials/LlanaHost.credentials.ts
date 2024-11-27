import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class LlanaHost implements ICredentialType {
	name = 'llanaHost';

	displayName = 'Llana Host';

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
