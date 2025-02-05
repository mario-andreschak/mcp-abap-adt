#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Verbose logging function
function log(message: string) {
  console.error(`[${new Date().toISOString()}] ${message}`);
}

// Log the environment variables (without sensitive information)
log('Environment variables loaded');
log(`SAP_URL: ${process.env.SAP_URL }`);
log(`SAP_USERNAME: ${process.env.SAP_USERNAME }`);
//log(`SAP_PASSWORD: ${process.env.SAP_PASSWORD }`);
log(`SAP_CLIENT: ${process.env.SAP_CLIENT }`);

interface SapConfig {
  url: string;
  username: string;
  password: string;
  client: string;
}

function getConfig(): SapConfig {
  log('Loading SAP configuration from environment variables');
  const url = process.env.SAP_URL;
  const username = process.env.SAP_USERNAME;
  const password = process.env.SAP_PASSWORD;
  const client = process.env.SAP_CLIENT;

  if (!url || !username || !password || !client) {
    throw new Error(`Missing required environment variables. Required variables:
- SAP_URL
- SAP_USERNAME
- SAP_PASSWORD
- SAP_CLIENT`);
  }

  log('SAP configuration loaded successfully');
  return { url, username, password, client };
}

class mcp_abap_adt_server {
  private server: Server;

  private sapConfig: SapConfig;

  constructor() {
    log('Initializing mcp_abap_adt_server');
    this.sapConfig = getConfig();
    this.server = new Server(
      {
        name: 'mcp-abap-adt',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.setupHandlers();
    log('mcp_abap_adt_server initialized');
  }

  private setupHandlers() {
    log('Setting up request handlers');
    // Setup tool handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      log('Handling ListToolsRequest');
      return {
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
      };
    });

    // Implement tool execution handlers
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      log(`Handling CallToolRequest for tool: ${request.params.name}`);
      switch (request.params.name) {
        case 'get_program_source':
          return await this.handleGetProgramSource(request.params.arguments);
        case 'get_program_properties':
          return await this.handleGetProgramProperties(request.params.arguments);
        default:
          log(`Unknown tool requested: ${request.params.name}`);
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });

    process.on('SIGINT', async () => {
      log('Received SIGINT signal, shutting down server');
      await this.server.close();
      process.exit(0);
    });

    log('Request handlers setup completed');
  }

  private createAxiosInstance() {
    log('Creating Axios instance');
    return axios.create({
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false
      })
    });
  }

  private getAuthHeaders() {
    log('Generating authentication headers');
    const { username, password, client } = this.sapConfig;
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    log(`Authorization header generated (${auth})`);
    return {
      'Authorization': `Basic ${auth}`,
      'X-SAP-Client': client
    };
  }

  private getBaseUrl() {
    log('Getting base URL');
    const { url } = this.sapConfig;
    const { username, password, client } = this.sapConfig;
    try {
      const urlObj = new URL(url);
      const baseUrl = Buffer.from(`${urlObj.origin}`);
      log(`Base URL: ${baseUrl}`);
      return baseUrl;
    } catch (error) {
      const errorMessage = `Invalid URL in configuration: ${error instanceof Error ? error.message : error}`;
      log(`Error: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  private validateProgramArgs(args: any, toolName: string) {
    log(`Validating arguments for ${toolName}`);
    if (typeof args !== 'object' || args === null || typeof args.program_name !== 'string') {
      const errorMessage = `Invalid arguments for ${toolName}`;
      log(`Error: ${errorMessage}`);
      throw new McpError(ErrorCode.InvalidParams, errorMessage);
    }
    log(`Arguments for ${toolName} are valid`);
    return args.program_name;
  }

  private async makeAdtRequest(url: string, method: string, timeout: number) {
    try {
      log(`Making ADT request: ${method} ${url}`);
      const response = await this.createAxiosInstance()({
        method,
        url,
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        timeout
      });
      log(`Successfully made ADT request: ${method} ${url}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response ? `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}` : error.message;
        const errorMessage = `ADT request failed: ${message}`;
        log(`Error: ${errorMessage}`);
        log(`Request config: ${JSON.stringify(error.config)}`);
        throw new McpError(ErrorCode.InternalError, errorMessage);
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const errorMessage = `ADT request failed: ${message}`;
        log(`Error: ${errorMessage}`);
        throw new McpError(ErrorCode.InternalError, errorMessage);
      }
    }
  }

  private async handleGetProgramSource(args: any) {
    const programName = this.validateProgramArgs(args, 'get_program_source');
    log(`Retrieving source code for program: ${programName}`);
    const url = `${this.getBaseUrl()}/sap/bc/adt/programs/programs/${programName}/source/main`;
    const data = await this.makeAdtRequest(url, 'GET', 30000);
    return {
      content: [{
        type: 'text',
        text: data
      }]
    };
  }

  private async handleGetProgramProperties(args: any) {
    const programName = this.validateProgramArgs(args, 'get_program_properties');
    log(`Retrieving properties for program: ${programName}`);
    const url = `${this.getBaseUrl()}/sap/bc/adt/programs/programs/${programName}`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  async run() {
    log('Starting mcp_abap_adt_server');
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    log('mcp_abap_adt_server is now running');
  }
}

const server = new mcp_abap_adt_server();
log('Initializing mcp_abap_adt_server');
server.run().catch((error) => {
  log(`Error running mcp_abap_adt_server: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
