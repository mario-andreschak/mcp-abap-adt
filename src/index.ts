#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import path from 'path';
import dotenv from 'dotenv';

// Import handler functions
import { handleGetProgram } from './handlers/handleGetProgram';
import { handleGetClass } from './handlers/handleGetClass';
import { handleGetFunctionGroup } from './handlers/handleGetFunctionGroup';
import { handleGetFunction } from './handlers/handleGetFunction';
import { handleGetTable } from './handlers/handleGetTable';
import { handleGetStructure } from './handlers/handleGetStructure';
import { handleGetTableContents } from './handlers/handleGetTableContents';
import { handleGetPackage } from './handlers/handleGetPackage';
import { handleGetInclude } from './handlers/handleGetInclude';
import { handleGetTypeInfo } from './handlers/handleGetTypeInfo';
import { handleGetInterface } from './handlers/handleGetInterface';
import { handleGetTransaction } from './handlers/handleGetTransaction';
import { handleSearchObject } from './handlers/handleSearchObject';

// Import shared utility functions and types
import { getBaseUrl, getAuthHeaders, createAxiosInstance, makeAdtRequest, return_error, return_response } from './lib/utils';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Interface for SAP configuration
export interface SapConfig {
  url: string;
  username: string;
  password: string;
  client: string;
}

/**
 * Retrieves SAP configuration from environment variables.
 *
 * @returns {SapConfig} The SAP configuration object.
 * @throws {Error} If any required environment variable is missing.
 */
export function getConfig(system: string = 'S4H'): SapConfig {
  const prefix = system.toUpperCase();
  const url = process.env[`${prefix}_SAP_URL`];
  const username = process.env[`${prefix}_SAP_USERNAME`];
  const password = process.env[`${prefix}_SAP_PASSWORD`];
  const client = process.env[`${prefix}_SAP_CLIENT`];

  if (!url || !username || !password || !client) {
    throw new Error(`Missing required environment variables for system "${system}". Expected:
- ${prefix}_SAP_URL
- ${prefix}_SAP_USERNAME
- ${prefix}_SAP_PASSWORD
- ${prefix}_SAP_CLIENT`);
  }

  return { url, username, password, client };
}

/**
 * Server class for interacting with ABAP systems via ADT.
 */
export class mcp_abap_adt_server {
  private server: Server;  // Instance of the MCP server
  private sapConfig: SapConfig; // SAP configuration

  /**
   * Constructor for the mcp_abap_adt_server class.
   */
  constructor() {
    this.sapConfig = getConfig(); // Load SAP configuration
    this.server = new Server(  // Initialize the MCP server
      {
        name: 'mcp-abap-adt', // Server name
        version: '0.1.0',       // Server version
      },
      {
        capabilities: {
          tools: {}, // Initially, no tools are registered
        },
      }
    );

    this.setupHandlers(); // Setup request handlers
  }

  /**
   * Sets up request handlers for listing and calling tools.
   * @private
   */
  private setupHandlers() {
    // Setup tool handlers

    // Handler for ListToolsRequest
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [ // Define available tools
          {
            name: 'GetProgram',
            description: 'Retrieve ABAP program source code',
            inputSchema: {
              type: 'object',
              properties: {
                program_name: { type: 'string', description: 'Name of the ABAP program' },
                sap_system: { type: 'string', description: 'SAP system (e.g. S4H, DHB). Default: S4H', default: 'S4H' }
              },
              required: ['program_name']
            }
          },
          {
            name: 'GetClass',
            description: 'Retrieve ABAP class source code',
            inputSchema: {
              type: 'object',
              properties: {
                class_name: { type: 'string', description: 'Name of the ABAP class' },
                sap_system: { type: 'string', description: 'SAP system (e.g. S4H, DHB). Default: S4H', default: 'S4H' }
              },
              required: ['class_name']
            }
          },
          {
            name: 'GetFunctionGroup',
            description: 'Retrieve ABAP Function Group source code',
            inputSchema: {
              type: 'object',
              properties: {
                function_group: { type: 'string', description: 'Name of the function group' },
                sap_system: { type: 'string', description: 'SAP system (e.g. S4H, DHB). Default: S4H', default: 'S4H' }
              },
              required: ['function_group']
            }
          },
          {
            name: 'GetFunction',
            description: 'Retrieve ABAP Function Module source code',
            inputSchema: {
              type: 'object',
              properties: {
                function_name: { type: 'string', description: 'Name of the function module' },
                function_group: { type: 'string', description: 'Name of the function group' },
                sap_system: { type: 'string', description: 'SAP system (e.g. S4H, DHB). Default: S4H', default: 'S4H' }
              },
              required: ['function_name', 'function_group']
            }
          },
          {
            name: 'GetStructure',
            description: 'Retrieve ABAP Structure',
            inputSchema: {
              type: 'object',
              properties: {
                structure_name: { type: 'string', description: 'Name of the ABAP Structure' },
                sap_system: { type: 'string', description: 'SAP system (e.g. S4H, DHB). Default: S4H', default: 'S4H' }
              },
              required: ['structure_name']
            }
          },
          {
            name: 'GetTable',
            description: 'Retrieve ABAP table structure',
            inputSchema: {
              type: 'object',
              properties: {
                table_name: { type: 'string', description: 'Name of the ABAP table' },
                sap_system: { type: 'string', description: 'SAP system (e.g. S4H, DHB). Default: S4H', default: 'S4H' }
              },
              required: ['table_name']
            }
          },
          {
            name: 'GetTableContents',
            description: 'Retrieve contents of an ABAP table',
            inputSchema: {
              type: 'object',
              properties: {
                table_name: { type: 'string', description: 'Name of the ABAP table' },
                max_rows: { type: 'number', description: 'Maximum number of rows to retrieve', default: 100 },
                sap_system: { type: 'string', description: 'SAP system (e.g. S4H, DHB). Default: S4H', default: 'S4H' }
              },
              required: ['table_name']
            }
          },
          {
            name: 'GetPackage',
            description: 'Retrieve ABAP package details',
            inputSchema: {
              type: 'object',
              properties: {
                package_name: { type: 'string', description: 'Name of the ABAP package' },
                sap_system: { type: 'string', description: 'SAP system (e.g. S4H, DHB). Default: S4H', default: 'S4H' }
              },
              required: ['package_name']
            }
          },
          {
            name: 'GetTypeInfo',
            description: 'Retrieve ABAP type information',
            inputSchema: {
              type: 'object',
              properties: {
                type_name: { type: 'string', description: 'Name of the ABAP type' },
                sap_system: { type: 'string', description: 'SAP system (e.g. S4H, DHB). Default: S4H', default: 'S4H' }
              },
              required: ['type_name']
            }
          },
          {
            name: 'GetInclude',
            description: 'Retrieve ABAP Include Source Code',
            inputSchema: {
              type: 'object',
              properties: {
                include_name: { type: 'string', description: 'Name of the ABAP Include' },
                sap_system: { type: 'string', description: 'SAP system (e.g. S4H, DHB). Default: S4H', default: 'S4H' }
              },
              required: ['include_name']
            }
          },
          {
            name: 'SearchObject',
            description: 'Search for ABAP objects using quick search',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query string (use * wildcard for partial match)' },
                maxResults: { type: 'number', description: 'Maximum number of results to return', default: 100 },
                sap_system: { type: 'string', description: 'SAP system (e.g. S4H, DHB). Default: S4H', default: 'S4H' }
              },
              required: ['query']
            }
          },
          {
            name: 'GetTransaction',
            description: 'Retrieve ABAP transaction details',
            inputSchema: {
              type: 'object',
              properties: {
                transaction_name: { type: 'string', description: 'Name of the ABAP transaction' },
                sap_system: { type: 'string', description: 'SAP system (e.g. S4H, DHB). Default: S4H', default: 'S4H' }
              },
              required: ['transaction_name']
            }
          },
          {
            name: 'GetInterface',
            description: 'Retrieve ABAP interface source code',
            inputSchema: {
              type: 'object',
              properties: {
                interface_name: { type: 'string', description: 'Name of the ABAP interface' },
                sap_system: { type: 'string', description: 'SAP system (e.g. S4H, DHB). Default: S4H', default: 'S4H' }
              },
              required: ['interface_name']
            }
          }
        ]
      };
    });

    // Handler for CallToolRequest
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'GetProgram':
          return await handleGetProgram(request.params.arguments);
        case 'GetClass':
          return await handleGetClass(request.params.arguments);
        case 'GetFunction':
          return await handleGetFunction(request.params.arguments);
        case 'GetFunctionGroup':
          return await handleGetFunctionGroup(request.params.arguments);
        case 'GetStructure':
          return await handleGetStructure(request.params.arguments);
        case 'GetTable':
          return await handleGetTable(request.params.arguments);
        case 'GetTableContents':
          return await handleGetTableContents(request.params.arguments);
        case 'GetPackage':
          return await handleGetPackage(request.params.arguments);
        case 'GetTypeInfo':
          return await handleGetTypeInfo(request.params.arguments);
        case 'GetInclude':
          return await handleGetInclude(request.params.arguments);
        case 'SearchObject':
          return await handleSearchObject(request.params.arguments);
        case 'GetInterface':
          return await handleGetInterface(request.params.arguments);
        case 'GetTransaction':
          return await handleGetTransaction(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });

    // Handle server shutdown on SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Starts the MCP server and connects it to the transport.
   */
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

// Create and run the server
const server = new mcp_abap_adt_server();
server.run().catch((error) => {
  process.exit(1);
});
