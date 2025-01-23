#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import ini from 'ini';

interface SapConfig {
  url: string;
  username: string;
  password: string;
  client: string;
}

function getConfig(): SapConfig {
  const configPath = path.join(__dirname, '../config.ini');
  
  try {
    const config = ini.parse(fs.readFileSync(configPath, 'utf-8'));
    
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
  } catch (error) {
    throw new Error(`Failed to read configuration: ${error instanceof Error ? error.message : error}`);
  }
}

class mcp_abap_adt_server {
  private server: Server;

  private sapConfig: SapConfig;

  constructor() {
    this.sapConfig = getConfig();
    this.server = new Server(
      {
        name: 'mcp-abap-adt',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );
    
    this.setupHandlers();
  }

  private setupHandlers() {
    // Setup tool handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
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
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'get_program_source':
          return await this.handleGetProgramSource(request.params.arguments);
        case 'get_program_properties':
          return await this.handleGetProgramProperties(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });

    // Setup resource handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
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

    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
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

  private createAxiosInstance() {
    return axios.create({
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false
      })
    });
  }

  private getAuthHeaders() {
    const { username, password, client } = this.sapConfig;
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    return {
      'Authorization': `Basic ${auth}`,
      'X-SAP-Client': client
    };
  }

  private getBaseUrl() {
    const { url } = this.sapConfig;
    try {
      const urlObj = new URL(url);
      if (!urlObj.port) {
        throw new Error('Port must be specified in the config URL');
      }
      return url;
    } catch (error) {
      throw new Error(`Invalid URL in configuration: ${error instanceof Error ? error.message : error}`);
    }
  }

  private validateProgramArgs(args: any, toolName: string) {
    if (typeof args !== 'object' || args === null || typeof args.program_name !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for ${toolName}`);
    }
    return args.program_name;
  }

  private async handleGetProgramSource(args: any) {
    try {
      const programName = this.validateProgramArgs(args, 'get_program_source');
      const response = await this.createAxiosInstance()({
        method: 'GET',
        url: `${this.getBaseUrl()}/sap/bc/adt/programs/programs/${programName}/source/main`,
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new McpError(ErrorCode.InternalError, `ABAP source retrieval failed: ${message}`);
    }
  }

  private async handleGetProgramProperties(args: any) {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new McpError(ErrorCode.InternalError, `ABAP properties retrieval failed: ${message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

const server = new mcp_abap_adt_server();
server.run();
