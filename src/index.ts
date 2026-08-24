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
import { handleGetCDSView } from './handlers/handleGetCDSView';
import { handleGetBehaviorDefinition } from './handlers/handleGetBehaviorDefinition';
import { handleGetServiceDefinition } from './handlers/handleGetServiceDefinition';

// Import shared utility functions and types
import { getBaseUrl, getAuthHeaders, createAxiosInstance, makeAdtRequest, return_error, return_response } from './lib/utils';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Shared schema fragments for paging through large text results (source code,
// DDL, etc.) instead of returning everything in one response.
const PAGING_START_LINE = {
  type: 'number',
  description: '1-based line number to start from (default 1). Use with maxLines to page through large results.'
};
const PAGING_MAX_LINES = {
  type: 'number',
  description: 'Maximum number of lines to return from startLine. Omit to return the rest of the result.'
};

// Same idea as PAGING_START_LINE/PAGING_MAX_LINES, but for results that are
// a list of items (e.g. GetPackage's member list) rather than multi-line text.
const PAGING_START_INDEX = {
  type: 'number',
  description: '0-based item index to start from (default 0). Use with maxItems to page through a large list.'
};
const PAGING_MAX_ITEMS = {
  type: 'number',
  description: 'Maximum number of items to return from startIndex. Omit to return the rest of the list.'
};

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
export function getConfig(): SapConfig {
  const url = process.env.SAP_URL;
  const username = process.env.SAP_USERNAME;
  const password = process.env.SAP_PASSWORD;
  const client = process.env.SAP_CLIENT;

  // Check if all required environment variables are set
  if (!url || !username || !password || !client) {
    throw new Error(`Missing required environment variables. Required variables:
- SAP_URL
- SAP_USERNAME
- SAP_PASSWORD
- SAP_CLIENT`);
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
            description: 'Retrieve ABAP program source code. For large programs, use startLine/maxLines to page through the source instead of retrieving it all at once.',
            inputSchema: {
              type: 'object',
              properties: {
                program_name: {
                  type: 'string',
                  description: 'Name of the ABAP program'
                },
                startLine: PAGING_START_LINE,
                maxLines: PAGING_MAX_LINES
              },
              required: ['program_name']
            }
          },
          {
            name: 'GetClass',
            description: 'Retrieve ABAP class source code. For large classes, use startLine/maxLines to page through the source instead of retrieving it all at once.',
            inputSchema: {
              type: 'object',
              properties: {
                class_name: {
                  type: 'string',
                  description: 'Name of the ABAP class'
                },
                startLine: PAGING_START_LINE,
                maxLines: PAGING_MAX_LINES
              },
              required: ['class_name']
            }
          },
          {
            name: 'GetFunctionGroup',
            description: 'Retrieve ABAP Function Group source code. For large function groups, use startLine/maxLines to page through the source instead of retrieving it all at once.',
            inputSchema: {
              type: 'object',
              properties: {
                function_group: {
                  type: 'string',
                  description: 'Name of the function module'
                },
                startLine: PAGING_START_LINE,
                maxLines: PAGING_MAX_LINES
              },
              required: ['function_group']
            }
          },
          {
            name: 'GetFunction',
            description: 'Retrieve ABAP Function Module source code. For large function modules, use startLine/maxLines to page through the source instead of retrieving it all at once.',
            inputSchema: {
              type: 'object',
              properties: {
                function_name: {
                  type: 'string',
                  description: 'Name of the function module'
                },
                function_group: {
                  type: 'string',
                  description: 'Name of the function group'
                },
                startLine: PAGING_START_LINE,
                maxLines: PAGING_MAX_LINES
              },
              required: ['function_name', 'function_group']
            }
          },
          {
            name: 'GetStructure',
            description: 'Retrieve ABAP Structure. For large structures, use startLine/maxLines to page through the result instead of retrieving it all at once.',
            inputSchema: {
              type: 'object',
              properties: {
                structure_name: {
                  type: 'string',
                  description: 'Name of the ABAP Structure'
                },
                startLine: PAGING_START_LINE,
                maxLines: PAGING_MAX_LINES
              },
              required: ['structure_name']
            }
          },
          {
            name: 'GetTable',
            description: 'Retrieve ABAP table structure. For large tables, use startLine/maxLines to page through the result instead of retrieving it all at once.',
            inputSchema: {
              type: 'object',
              properties: {
                table_name: {
                  type: 'string',
                  description: 'Name of the ABAP table'
                },
                startLine: PAGING_START_LINE,
                maxLines: PAGING_MAX_LINES
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
                table_name: {
                  type: 'string',
                  description: 'Name of the ABAP table'
                },
                max_rows: {
                  type: 'number',
                  description: 'Maximum number of rows to retrieve',
                  default: 100
                }
              },
              required: ['table_name']
            }
          },
          {
            name: 'GetPackage',
            description: 'Retrieve ABAP package details. For packages with many members, use startIndex/maxItems to page through the member list instead of retrieving it all at once.',
            inputSchema: {
              type: 'object',
              properties: {
                package_name: {
                  type: 'string',
                  description: 'Name of the ABAP package'
                },
                startIndex: PAGING_START_INDEX,
                maxItems: PAGING_MAX_ITEMS
              },
              required: ['package_name']
            }
          },
          {
            name: 'GetTypeInfo',
            description: 'Retrieve ABAP type information. For large results, use startLine/maxLines to page through it instead of retrieving it all at once.',
            inputSchema: {
              type: 'object',
              properties: {
                type_name: {
                  type: 'string',
                  description: 'Name of the ABAP type'
                },
                startLine: PAGING_START_LINE,
                maxLines: PAGING_MAX_LINES
              },
              required: ['type_name']
            }
          },
          {
            name: 'GetInclude',
            description: 'Retrieve ABAP Include Source Code. For large includes, use startLine/maxLines to page through the source instead of retrieving it all at once.',
            inputSchema: {
              type: 'object',
              properties: {
                include_name: {
                  type: 'string',
                  description: 'Name of the ABAP Include'
                },
                startLine: PAGING_START_LINE,
                maxLines: PAGING_MAX_LINES
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
                query: {
                  type: 'string',
                  description: 'Search query string (use * wildcard for partial match)'
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of results to return',
                  default: 100
                }
              },
              required: ['query']
            }
          },
          {
            name: 'GetTransaction',
            description: 'Retrieve ABAP transaction details. For large results, use startLine/maxLines to page through it instead of retrieving it all at once.',
            inputSchema: {
              type: 'object',
              properties: {
                transaction_name: {
                  type: 'string',
                  description: 'Name of the ABAP transaction'
                },
                startLine: PAGING_START_LINE,
                maxLines: PAGING_MAX_LINES
              },
              required: ['transaction_name']
            }
          },
          {
            name: 'GetCDSView',
            description: 'Retrieve CDS view (DDL source) source code. For large views, use startLine/maxLines to page through the source instead of retrieving it all at once.',
            inputSchema: {
              type: 'object',
              properties: {
                cds_view_name: {
                  type: 'string',
                  description: 'Name of the CDS view (DDL source name, e.g. I_CURRENCY)'
                },
                startLine: PAGING_START_LINE,
                maxLines: PAGING_MAX_LINES
              },
              required: ['cds_view_name']
            }
          },
          {
            name: 'GetInterface',
            description: 'Retrieve ABAP interface source code. For large interfaces, use startLine/maxLines to page through the source instead of retrieving it all at once.',
            inputSchema: {
              type: 'object',
              properties: {
                interface_name: {
                  type: 'string',
                  description: 'Name of the ABAP interface'
                },
                startLine: PAGING_START_LINE,
                maxLines: PAGING_MAX_LINES
              },
              required: ['interface_name']
            }
          },
          {
            name: 'GetBehaviorDefinition',
            description: 'Retrieve RAP Behavior Definition (BDEF) source code (requires ~NW 7.54 / S/4HANA). For large definitions, use startLine/maxLines to page through the source instead of retrieving it all at once.',
            inputSchema: {
              type: 'object',
              properties: {
                behavior_definition_name: {
                  type: 'string',
                  description: 'Name of the RAP Behavior Definition (e.g. I_MY_ENTITY)'
                },
                startLine: PAGING_START_LINE,
                maxLines: PAGING_MAX_LINES
              },
              required: ['behavior_definition_name']
            }
          },
          {
            name: 'GetServiceDefinition',
            description: 'Retrieve RAP Service Definition (SRVD) source code (requires ~NW 7.54 / S/4HANA). For large definitions, use startLine/maxLines to page through the source instead of retrieving it all at once.',
            inputSchema: {
              type: 'object',
              properties: {
                service_definition_name: {
                  type: 'string',
                  description: 'Name of the RAP Service Definition (e.g. Z_MY_SERVICE)'
                },
                startLine: PAGING_START_LINE,
                maxLines: PAGING_MAX_LINES
              },
              required: ['service_definition_name']
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
        case 'GetCDSView':
          return await handleGetCDSView(request.params.arguments);
        case 'GetBehaviorDefinition':
          return await handleGetBehaviorDefinition(request.params.arguments);
        case 'GetServiceDefinition':
          return await handleGetServiceDefinition(request.params.arguments);
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
