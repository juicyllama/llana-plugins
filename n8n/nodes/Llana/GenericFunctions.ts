import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export async function apiRequest(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: any = {},
	query: IDataObject = {},
): Promise<any> {
	const authenticationMethod = <string>this.getNodeParameter('authentication', 0);

    let credentials;

    if (authenticationMethod === 'apiKey') {
        credentials = await this.getCredentials('llanaKeyApi');
    } else if (authenticationMethod === 'userPass') {
        credentials = await this.getCredentials('llanaAuthApi');
    } else {
    	credentials = await this.getCredentials('llanaHostApi');
    }

	const baseUrl = credentials.host as string;

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl.replace(new RegExp('/$'), '')}/${endpoint}`,
		json: true,
		body,
		qs: query,
	};

	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, authenticationMethod, options);
	} catch (error) {
		if (error instanceof NodeApiError) {
			throw error;
		}
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export async function apiRequestAllItems(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	propertyName: string,
	method: IHttpRequestMethods,
	endpoint: string,
	body: any = {},
	query: IDataObject = {},
): Promise<any> {
	const returnData: IDataObject[] = [];

	let responseData;

	do {
		responseData = await apiRequest.call(this, method, endpoint, body, query);
		returnData.push.apply(returnData, responseData[propertyName] as IDataObject[]);
		query.page = responseData.pagination.page.next;
	} while (responseData.pagination.page.next != null);

	return returnData;
}

export async function getTables(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const data = (await apiRequest.call(this, 'GET', 'tables')) as any;
	const results = data.tables.map((table: string) => ({
		name: table,
		value: table,
	}));
	return results;
}

export async function getFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const schema = await apiRequest.call(this, 'GET', `${this.getNodeParameter('table')}/schema`);
	const results = schema.columns.map((c: any) => ({
		name: `${c.field} [${c.type}]`,
		value: c.field,
	}));
	return results;
}
