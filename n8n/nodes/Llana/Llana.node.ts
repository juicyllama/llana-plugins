import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

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
						operation: ['get,getMany'],
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
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					if (returnAll) {
						response = await apiRequestAllItems.call(this, 'data', 'GET', `${table}/`, {}, {});
					} else {
						response = await apiRequest.call(
							this,
							'GET',
							`${table}/`,
							{},
							{ limit: this.getNodeParameter('limit', i) as number },
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
