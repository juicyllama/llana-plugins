import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { BINARY_ENCODING, NodeOperationError, jsonParse } from 'n8n-workflow';
import type { Readable } from 'stream';

import { apiRequest, apiRequestAllItems, getTables, getFields } from './GenericFunctions';

export type FieldsUiValues = Array<{
	fieldId: string;
	fieldValue: string;
}>;

export class Llana implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Llana',
		name: 'llana',
		// eslint-disable-next-line n8n-nodes-base/node-class-description-icon-not-svg
		icon: 'file:llana.png',
		group: ['input'],
		version: 1,
		subtitle: '={{ $parameter["operation"] }}',
		description: 'Consume Llana API',
		defaults: {
			name: 'llana',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
            {
                name: 'llanaKeyApi',
                required: false,
                displayName: 'API Key',
                displayOptions: {
                    show: {
                        authentication: ['apiKey'],
                    },
                },
            },
            {
                name: 'llanaAuthApi',
                required: false,
                displayName: 'Username & Password',
                displayOptions: {
                    show: {
                        authentication: ['userPass'],
                    },
                },
            },
            {
                name: 'llanaHostApi',
                required: false,
                displayName: 'Host',
                displayOptions: {
                    show: {
                        authentication: ['hostApi'],
                    },
                },
            },
        ],
		properties: [
			{
                displayName: 'Authentication',
                name: 'authentication',
                type: 'options',
                options: [
                    {
                        name: 'API Key',
                        value: 'apiKey',
                    },
                    {
                        name: 'Username & Password',
                        value: 'userPass',
                    },
                                        {
                        name: 'Host API',
                        value: 'hostApi',
                    },
                ],
                default: 'apiKey',
            },
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Create',
						value: 'create',
						description: 'Create a record',
						action: 'Create a record',
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete a record',
						action: 'Delete a record',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get single record',
						action: 'Get single record',
					},
					{
						name: 'List Records',
						value: 'getMany',
						description: 'List many records',
						action: 'List many records',
					},
					{
						name: 'Update',
						value: 'update',
						description: 'Update a record',
						action: 'Update a record',
					}
				],
				default: 'get',
			},
			// Fields
			{
				displayName: 'Table Name or ID',
				name: 'table',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getTables',
				},
				default: '',
				required: true,
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
			},
			// Get
			{
				displayName: 'Record ID',
				name: 'recordId',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['delete', 'get', 'update'],
					},
				},
				default: '',
				required: true,
				description: 'ID of the record to work with',
			},
			{
				// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-multi-options
				displayName: 'Fields',
				name: 'fields',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getFields',
				},
				displayOptions: {
					show: {
						operation: ['get','getMany'],
					},
				},
				default: [],
				// eslint-disable-next-line n8n-nodes-base/node-param-description-wrong-for-dynamic-multi-options
				description: 'Fields to include in the response',
			},
			// Get Many
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				displayOptions: {
					show: {
						operation: ['getMany'],
					},
				},
				default: false,
				description: 'Whether to return all results or only up to a given limit',
			},
			{
				displayName: 'Send Query Parameters',
				name: 'sendQuery',
				type: 'boolean',
				displayOptions: {
					show: {
						operation: ['getMany']
					},
				},
				default: false,
				noDataExpression: true,
				description: 'Whether the request has query params or not',
			},
			{
				displayName: 'Specify Query Parameters',
				name: 'specifyQuery',
				type: 'options',
				displayOptions: {
					show: {
						operation: ['getMany'],
						sendQuery: [true],
					},
				},
				options: [
					{
						name: 'Using Fields Below',
						value: 'keypair',
					},
					{
						name: 'Using JSON',
						value: 'json',
					},
				],
				default: 'keypair',
			},
			{
				displayName: 'Query Parameters',
				name: 'queryParameters',
				type: 'fixedCollection',
				displayOptions: {
					show: {
						operation: ['getMany'],
						sendQuery: [true],
						specifyQuery: ['keypair'],
					},
				},
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Parameter',
				default: {
					parameters: [
						{
							name: '',
							value: '',
						},
					],
				},
				options: [
					{
						name: 'parameters',
						displayName: 'Parameter',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
							},
						],
					},
				],
			},
			{
				displayName: 'JSON',
				name: 'jsonQuery',
				type: 'json',
				displayOptions: {
					show: {
						operation: ['getMany'],
						sendQuery: [true],
						specifyQuery: ['json'],
					},
				},
				default: '',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				displayOptions: {
					show: {
						operation: ['getMany'],
						returnAll: [false],
					},
				},
				typeOptions: {
					minValue: 1,
				},
				default: 50,
				description: 'Max number of results to return',
			},
			// Create and Update
			{
				displayName: 'Fields to Send',
				name: 'fieldsUi',
				placeholder: 'Add Field',
				type: 'fixedCollection',
				typeOptions: {
					multipleValueButtonText: 'Add Field to Send',
					multipleValues: true,
				},
				displayOptions: {
					show: {
						operation: ['create', 'update'],
					},
				},
				default: {},
				options: [
					{
						displayName: 'Field',
						name: 'fieldValues',
						values: [
							{
								displayName: 'Field Name or ID',
								name: 'fieldId',
								type: 'options',
								description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
								typeOptions: {
									loadOptionsDependsOn: ['table'],
									loadOptionsMethod: 'getFields',
								},
								default: '',
							},
							{
								displayName: 'Field Value',
								name: 'fieldValue',
								type: 'string',
								default: '',
							},
						],
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			getTables,
			getFields,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		let response;

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i);
				const table = this.getNodeParameter('table', i) as string;

				if (operation === 'get') {
					const recordId = this.getNodeParameter('recordId', i) as string;
					const fields = this.getNodeParameter('fields', i) as string[];
					const qs: any = {};
					if (fields.length !== 0) {
						qs.fields = fields.join(',');
					}

					response = await apiRequest.call(this, 'GET', `${table}/${recordId}`, {}, qs);
				}

				if (operation === 'getMany') {

					const sendQuery = this.getNodeParameter('sendQuery', i, false) as boolean;
					const queryParameters = this.getNodeParameter(
						'queryParameters.parameters',
						i,
						[],
					) as [{ name: string; value: string }];
					const specifyQuery = this.getNodeParameter('specifyQuery', i, 'keypair') as string;
					const jsonQueryParameter = this.getNodeParameter('jsonQuery', i, '') as string;

					const parametersToKeyValue = async (
						accumulator: { [key: string]: any },
						cur: { name: string; value: string; parameterType?: string; inputDataFieldName?: string },
					) => {
						if (cur.parameterType === 'formBinaryData') {
							if (!cur.inputDataFieldName) return accumulator;
							const binaryData = this.helpers.assertBinaryData(i, cur.inputDataFieldName);
							let uploadData: Buffer | Readable;
							const itemBinaryData = items[i].binary![cur.inputDataFieldName];
							if (itemBinaryData.id) {
								uploadData = await this.helpers.getBinaryStream(itemBinaryData.id);
							} else {
								uploadData = Buffer.from(itemBinaryData.data, BINARY_ENCODING);
							}

							accumulator[cur.name] = {
								value: uploadData,
								options: {
									filename: binaryData.fileName,
									contentType: binaryData.mimeType,
								},
							};
							return accumulator;
						}
						accumulator[cur.name] = cur.value;
						return accumulator;
					};

					let qs: IDataObject = {};

					// Get parameters defined in the UI
					if (sendQuery && queryParameters) {
						if (specifyQuery === 'keypair') {
							qs = await reduceAsync(queryParameters, parametersToKeyValue);
						} else if (specifyQuery === 'json') {
							// query is specified using JSON
							try {
								JSON.parse(jsonQueryParameter);
							} catch {
								throw new NodeOperationError(
									this.getNode(),
									'JSON parameter needs to be valid JSON',
									{
										itemIndex: i,
									},
								);
							}

							qs = jsonParse(jsonQueryParameter);
						}
					}


					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					if (returnAll) {
						response = await apiRequestAllItems.call(this, 'data', 'GET', `${table}/`, {}, qs);
					} else {
						response = await apiRequest.call(
							this,
							'GET',
							`${table}/`,
							{},
							{ ...qs, limit: this.getNodeParameter('limit', i) as number },
						);
						response = response.data;
					}
				}

				if (operation === 'create') {
					const body: IDataObject = {};

					const fieldsUi = this.getNodeParameter('fieldsUi.fieldValues', i, []) as FieldsUiValues;
					for (const field of fieldsUi) {
						body[field.fieldId] = field.fieldValue;
					}

					response = await apiRequest.call(this, 'POST', `${table}/`, body);
				}

				if (operation === 'update') {
					const body: IDataObject = {};
					const recordId = this.getNodeParameter('recordId', i) as string;

					const fieldsUi = this.getNodeParameter('fieldsUi.fieldValues', i, []) as FieldsUiValues;
					for (const field of fieldsUi) {
						body[field.fieldId] = field.fieldValue;
					}

					response = await apiRequest.call(this, 'PUT', `${table}/${recordId}`, body);
				}

				if (operation === 'delete') {
					const recordId = this.getNodeParameter('recordId', i) as string;
					response = await apiRequest.call(this, 'DELETE', `${table}/${recordId}`);
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(response as IDataObject),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					const executionData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray({ error: error.message }),
						{ itemData: { item: i } },
					);
					returnData.push(...executionData);
					continue;
				}
				throw error;
			}
		}
		return [returnData];
	}
}

async function reduceAsync<T, R>(
	arr: T[],
	reducer: (acc: Awaited<Promise<R>>, cur: T) => Promise<R>,
	init: Promise<R> = Promise.resolve({} as R),
): Promise<R> {
	return await arr.reduce(async (promiseAcc, item) => {
		return await reducer(await promiseAcc, item);
	}, init);
}

