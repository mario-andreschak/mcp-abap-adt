#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ini_1 = __importDefault(require("ini"));
function getConfig() {
    const configPath = path_1.default.join(__dirname, '../config.ini');
    try {
        const config = ini_1.default.parse(fs_1.default.readFileSync(configPath, 'utf-8'));
        if (!config.mcp_abap_adt) {
            throw new Error('mcp_abap_adt section not found in config.ini');
        }
        const { url, username, password, client } = config.mcp_abap_adt;
        if (!url || !username || !password || !client) {
            throw new Error(`Missing required configuration in config.ini. Required fields:
- url
- username
- password
- client`);
        }
        return { url, username, password, client };
    }
    catch (error) {
        throw new Error(`Failed to read configuration: ${error instanceof Error ? error.message : error}`);
    }
}
class mcp_abap_adt_server {
    server;
    sapConfig;
    constructor() {
        this.sapConfig = getConfig();
        this.server = new index_js_1.Server({
            name: 'mcp-abap-adt',
            version: '0.1.0',
        }, {
            capabilities: {
                resources: {},
                tools: {},
            },
        });
        this.setupHandlers();
    }
    setupHandlers() {
        // Setup tool handlers
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'get_program_source',
                    description: 'Retrieve source code of an ABAP program',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            program_name: {
                                type: 'string',
                                description: 'Name of the ABAP program to retrieve'
                            }
                        },
                        required: ['program_name']
                    }
                },
                {
                    name: 'get_program_properties',
                    description: 'Retrieve properties for an ABAP program',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            program_name: {
                                type: 'string',
                                description: 'Name of the ABAP program to retrieve properties for'
                            }
                        },
                        required: ['program_name']
                    }
                }
            ]
        }));
        // Implement tool execution handlers
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            switch (request.params.name) {
                case 'get_abap_source':
                    return await this.handleGetProgramSource(request.params.arguments);
                case 'get_program_properties':
                    return await this.handleGetProgramProperties(request.params.arguments);
                default:
                    throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
            }
        });
        // Setup resource handlers
        this.server.setRequestHandler(types_js_1.ListResourcesRequestSchema, async () => ({
            resources: [
                {
                    uri: 'abap://programs',
                    name: 'ABAP Programs',
                    description: 'List of available ABAP programs'
                },
                {
                    uri: 'abap://dictionary',
                    name: 'ABAP Dictionary',
                    description: 'ABAP Data Dictionary objects'
                }
            ]
        }));
        this.server.setRequestHandler(types_js_1.ListResourceTemplatesRequestSchema, async () => ({
            resourceTemplates: [
                {
                    uriTemplate: 'abap://programs/{program_name}',
                    name: 'ABAP Program Source',
                    description: 'Source code of a specific ABAP program'
                },
                {
                    uriTemplate: 'abap://dictionary/{object_type}/{object_name}',
                    name: 'ABAP Dictionary Object',
                    description: 'Specific ABAP Dictionary object'
                }
            ]
        }));
        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }
    createAxiosInstance() {
        return axios_1.default.create({
            httpsAgent: new (require('https').Agent)({
                rejectUnauthorized: false
            })
        });
    }
    getAuthHeaders() {
        const { username, password, client } = this.sapConfig;
        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        return {
            'Authorization': `Basic ${auth}`,
            'X-SAP-Client': client
        };
    }
    getBaseUrl() {
        const { url } = this.sapConfig;
        try {
            const urlObj = new URL(url);
            if (!urlObj.port) {
                throw new Error('Port must be specified in the config URL');
            }
            return url;
        }
        catch (error) {
            throw new Error(`Invalid URL in configuration: ${error instanceof Error ? error.message : error}`);
        }
    }
    validateProgramArgs(args, toolName) {
        if (typeof args !== 'object' || args === null || typeof args.program_name !== 'string') {
            throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `Invalid arguments for ${toolName}`);
        }
        return args.program_name;
    }
    async handleGetProgramSource(args) {
        try {
            const programName = this.validateProgramArgs(args, 'get_abap_source');
            const response = await this.createAxiosInstance()({
                method: 'GET',
                url: `${this.getBaseUrl()}/sap/bc/adt/programs/programs/${programName}/main`,
                headers: {
                    'Content-Type': 'text/plain',
                    ...this.getAuthHeaders()
                },
                timeout: 10000
            });
            return {
                content: [{
                        type: 'text',
                        text: response.data
                    }]
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `ABAP source retrieval failed: ${message}`);
        }
    }
    async handleGetProgramProperties(args) {
        try {
            const programName = this.validateProgramArgs(args, 'get_program_properties');
            const response = await this.createAxiosInstance()({
                method: 'GET',
                url: `${this.getBaseUrl()}/sap/bc/adt/programs/programs/${programName}`,
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders()
                },
                timeout: 10000
            });
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify(response.data, null, 2)
                    }]
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `ABAP properties retrieval failed: ${message}`);
        }
    }
    async run() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
    }
}
const server = new mcp_abap_adt_server();
server.run();
