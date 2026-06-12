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
import { handleSetProgram } from './handlers/handleSetProgram';
import { handleSetInclude } from './handlers/handleSetInclude';
import { handleSetClass } from './handlers/handleSetClass';
import { handleSetFunction } from './handlers/handleSetFunction';
import { handleDeleteObject } from './handlers/handleDeleteObject';
import { handleActivateObject } from './handlers/handleActivateObject';

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
            description: 'Retrieve ABAP program source code',
            inputSchema: {
              type: 'object',
              properties: {
                program_name: {
                  type: 'string',
                  description: 'Name of the ABAP program'
                }
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
                class_name: {
                  type: 'string',
                  description: 'Name of the ABAP class'
                }
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
                function_group: {
                  type: 'string',
                  description: 'Name of the function module'
                }
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
                function_name: {
                  type: 'string',
                  description: 'Name of the function module'
                },
                function_group: {
                  type: 'string',
                  description: 'Name of the function group'
                }
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
                structure_name: {
                  type: 'string',
                  description: 'Name of the ABAP Structure'
                }
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
                table_name: {
                  type: 'string',
                  description: 'Name of the ABAP table'
                }
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
            description: 'Retrieve ABAP package details',
            inputSchema: {
              type: 'object',
              properties: {
                package_name: {
                  type: 'string',
                  description: 'Name of the ABAP package'
                }
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
                type_name: {
                  type: 'string',
                  description: 'Name of the ABAP type'
                }
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
                include_name: {
                  type: 'string',
                  description: 'Name of the ABAP Include'
                }
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
            description: 'Retrieve ABAP transaction details',
            inputSchema: {
              type: 'object',
              properties: {
                transaction_name: {
                  type: 'string',
                  description: 'Name of the ABAP transaction'
                }
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
                interface_name: {
                  type: 'string',
                  description: 'Name of the ABAP interface'
                }
              },
              required: ['interface_name']
            }
          },
          {
            name: 'SetProgram',
            description: 'Overwrite the source code of an existing ABAP report/program (PROG/P). Uses ADT lock -> PUT source -> unlock. Use mcp__sap-adt-official__abap_activate_objects afterwards to compile.',
            inputSchema: {
              type: 'object',
              properties: {
                program_name: {
                  type: 'string',
                  description: 'Name of the ABAP program (e.g. /SKYVVA/TEST_INTERFACE or Z_ALV_TEST_01)'
                },
                source: {
                  type: 'string',
                  description: 'Full new source code to write (UTF-8, the entire object body)'
                },
                transport_request_number: {
                  type: 'string',
                  description: 'Optional. Only needed for non-$TMP objects not yet recorded in an open TR for this user.'
                }
              },
              required: ['program_name', 'source']
            }
          },
          {
            name: 'SetInclude',
            description: 'Overwrite the source code of an existing ABAP include (PROG/I). Uses ADT lock -> PUT source -> unlock. Activate afterwards via official MCP.',
            inputSchema: {
              type: 'object',
              properties: {
                include_name: {
                  type: 'string',
                  description: 'Name of the ABAP include'
                },
                source: {
                  type: 'string',
                  description: 'Full new source code to write'
                },
                transport_request_number: {
                  type: 'string',
                  description: 'Optional. Only needed for non-$TMP objects not yet recorded in an open TR for this user.'
                }
              },
              required: ['include_name', 'source']
            }
          },
          {
            name: 'SetClass',
            description: 'Overwrite the source of an ABAP class (CLAS/OC). By default writes the main source. For split classes, pass part = definitions | implementations | macros | testclasses. Activate via official MCP after.',
            inputSchema: {
              type: 'object',
              properties: {
                class_name: {
                  type: 'string',
                  description: 'Name of the ABAP class (e.g. ZCL_HELLO_SSO_TEST)'
                },
                source: {
                  type: 'string',
                  description: 'Full new source code to write'
                },
                part: {
                  type: 'string',
                  enum: ['main', 'definitions', 'implementations', 'macros', 'testclasses'],
                  default: 'main',
                  description: 'Which source part to write. Default: main (full class body).'
                },
                transport_request_number: {
                  type: 'string',
                  description: 'Optional. Only needed for non-$TMP objects not yet recorded in an open TR for this user.'
                }
              },
              required: ['class_name', 'source']
            }
          },
          {
            name: 'SetFunction',
            description: 'Overwrite the source of an ABAP function module (FUGR/FF). The new source is the body between FUNCTION ... ENDFUNCTION. Activate via official MCP after.',
            inputSchema: {
              type: 'object',
              properties: {
                function_name: {
                  type: 'string',
                  description: 'Name of the function module'
                },
                function_group: {
                  type: 'string',
                  description: 'Name of the function group containing this FM'
                },
                source: {
                  type: 'string',
                  description: 'Full new source code'
                },
                transport_request_number: {
                  type: 'string',
                  description: 'Optional. Only needed for non-$TMP objects not yet recorded in an open TR for this user.'
                }
              },
              required: ['function_name', 'function_group', 'source']
            }
          },
          {
            name: 'ActivateObject',
            description: 'Compile + activate an ABAP repository object (POST /sap/bc/adt/activation). Works for any object type — no IDE needed.',
            inputSchema: {
              type: 'object',
              properties: {
                object_type: {
                  type: 'string',
                  description: 'Object type: CLAS | INTF | PROG | PROG/I | FUGR | FUGR/FF (FM) | DDLS. Fully qualified codes (CLAS/OC etc.) also accepted. If omitted, supply object_uri instead.'
                },
                object_name: {
                  type: 'string',
                  description: 'Object name (e.g. /SKYVVA/TEST_INTERFACE).'
                },
                function_group: {
                  type: 'string',
                  description: 'REQUIRED when object_type is FUGR/FF (function module).'
                },
                object_uri: {
                  type: 'string',
                  description: 'Escape hatch: raw ADT URI (e.g. /sap/bc/adt/programs/programs/%2FSKYVVA%2FTEST_INTERFACE). Overrides object_type/name when present.'
                }
              }
            }
          },
          {
            name: 'DeleteObject',
            description: 'Delete an ABAP repository object (class, interface, program, include, function group, CDS). DESTRUCTIVE — confirm with user before invoking.',
            inputSchema: {
              type: 'object',
              properties: {
                object_type: {
                  type: 'string',
                  description: 'Object type: CLAS | INTF | PROG | PROG/I (include) | FUGR | DDLS. Fully qualified (CLAS/OC etc.) also accepted.'
                },
                object_name: {
                  type: 'string',
                  description: 'Object name'
                },
                transport_request_number: {
                  type: 'string',
                  description: 'Optional. Only needed for non-$TMP objects not yet recorded in an open TR for this user.'
                }
              },
              required: ['object_type', 'object_name']
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
        case 'SetProgram':
          return await handleSetProgram(request.params.arguments);
        case 'SetInclude':
          return await handleSetInclude(request.params.arguments);
        case 'SetClass':
          return await handleSetClass(request.params.arguments);
        case 'SetFunction':
          return await handleSetFunction(request.params.arguments);
        case 'DeleteObject':
          return await handleDeleteObject(request.params.arguments);
        case 'ActivateObject':
          return await handleActivateObject(request.params.arguments);
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
