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
import path, { join } from 'path';
import dotenv from 'dotenv';
import { Agent } from 'https';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Interface for SAP configuration
interface SapConfig {
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
function getConfig(): SapConfig {
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
class mcp_abap_adt_server {
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
                  description: 'Search query string'
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of results to return',
                  default: 100
                }
              },
              required: ['query']
            }
          }
        ]
      };
    });

    // Handler for CallToolRequest
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'GetProgram':
          return await this.handleGetProgram(request.params.arguments);
        case 'GetClass':
          return await this.handleGetClass(request.params.arguments);
        case 'GetFunction':
          return await this.handleGetFunction(request.params.arguments);
        case 'GetFunctionGroup':
          return await this.handleGetFunctionGroup(request.params.arguments);
        case 'GetStructure':
          return await this.handleGetStructure(request.params.arguments);
        case 'GetTable':
          return await this.handleGetTable(request.params.arguments);
        case 'GetTableContents':
          return await this.handleGetTableContents(request.params.arguments);
        case 'GetPackage':
          return await this.handleGetPackage(request.params.arguments);
        case 'GetTypeInfo':
          return await this.handleGetTypeInfo(request.params.arguments);
        case 'GetInclude':
          return await this.handleGetInclude(request.params.arguments);
        case 'SearchObject':
          return await this.handleSearchObject(request.params.arguments);
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
   * Creates an axios instance with custom HTTPS agent for ignoring SSL errors.
   * @private
   * @returns {import('axios').AxiosInstance} An axios instance.
   */
  private createAxiosInstance() {
    return axios.create({
      httpsAgent: new Agent({
        rejectUnauthorized: false // Allow self-signed certificates
      })
    });
  }

  /**
   * Generates authentication headers for SAP requests.
   * @private
   * @returns {object} An object containing the 'Authorization' and 'X-SAP-Client' headers.
   */
  private getAuthHeaders() {
    const { username, password, client } = this.sapConfig;
    const auth = Buffer.from(`${username}:${password}`).toString('base64'); // Create Basic Auth string
    return {
      'Authorization': `Basic ${auth}`, // Basic Authentication header
      'X-SAP-Client': client            // SAP client header
    };
  }

  /**
   * Extracts and encodes the base URL from the SAP URL.
   * @private
   * @returns {string} The encoded base URL.
   * @throws {Error} If the URL in the configuration is invalid.
   */
  private getBaseUrl() {
    const { url } = this.sapConfig;
    try {
      const urlObj = new URL(url);
      const baseUrl = Buffer.from(`${urlObj.origin}`);
      return baseUrl;
    } catch (error) {
      const errorMessage = `Invalid URL in configuration: ${error instanceof Error ? error.message : error}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Makes a request to the SAP system via ADT.
   * @param {string} url The ADT endpoint URL.
   * @param {string} method - The HTTP method ('GET', 'POST', etc.).
   * @param {number} timeout Request timeout in milliseconds.
   * @returns {Promise<any>} A Promise that resolves with the response data.
   */
  private async makeAdtRequest(url: string, method: string, timeout: number) {
    const response = await this.createAxiosInstance()({
      method,
      url,
      headers: {
        'Content-Type': 'text', // Set Content-Type header
        ...this.getAuthHeaders()  // Include authentication headers
      },
      timeout // Set request timeout
    });
    return response.data; // Return the response data
  }

  /**
   * Handles the 'GetProgram' tool request.
   * @private
   * @param {any} args The arguments passed to the tool.
   * @returns {Promise<object>} A Promise that resolves with the tool's result.
   */
  private async handleGetProgram(args: any) {
    try {
      if (!args?.program_name) {
        throw new McpError(ErrorCode.InvalidParams, 'Program name is required');
      }
      const url = `${this.getBaseUrl()}/sap/bc/adt/programs/programs/${args.program_name}/source/main`;
      const data = await this.makeAdtRequest(url, 'GET', 30000);
      return {
        content: [{
          type: 'text',
          text: data
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }

  /**
   * Handles the 'GetClass' tool request.
   * @private
   * @param {any} args - The arguments passed to the tool.
   * @returns {Promise<object>} - A Promise that resolves with the tool's result.
   */
  private async handleGetClass(args: any) {
    try {
      if (!args?.class_name) {
        throw new McpError(ErrorCode.InvalidParams, 'Class name is required');
      }
      const data = await this.makeAdtRequest(`${this.getBaseUrl()}/sap/bc/adt/oo/classes/${args.class_name}/source/main`, 'GET', 30000);
      return {
        content: [{
          type: 'text',
          text: data
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }

  /**
   * Handles the 'GetFunctionGroup' tool request.
   * @private
   * @param {any} args - The arguments passed to the tool.
   * @returns {Promise<object>} - A Promise that resolves with the tool's result.
   */
  private async handleGetFunctionGroup(args: any) {
    try {
      if (!args?.function_group) {
        throw new McpError(ErrorCode.InvalidParams, 'Function Group is required');
      }
      const url = `${this.getBaseUrl()}/sap/bc/adt/functions/groups/${args.function_group}/source/main`;
      const data = await this.makeAdtRequest(url, 'GET', 30000);
      return {
        content: [{
          type: 'text',
          text: data
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }

  /**
   * Handles the 'GetFunction' tool request.
   * @private
   * @param {any} args The arguments passed to the tool.
   * @returns {Promise<object>} A Promise that resolves with the tool's result.
   */
  private async handleGetFunction(args: any) {
    try {
      if (!args?.function_name || !args?.function_group) {
        throw new McpError(ErrorCode.InvalidParams, 'Function name and group are required');
      }
      const url = `${this.getBaseUrl()}/sap/bc/adt/functions/groups/${args.function_group}/fmodules/${args.function_name}/source/main`;
      const data = await this.makeAdtRequest(url, 'GET', 30000);
      return {
        content: [{
          type: 'text',
          text: data
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }

  /**
   * Handles the 'GetTable' tool request.
   * @private
   * @param {any} args The arguments passed to the tool.
   * @returns {Promise<object>} A Promise that resolves with the tool's result.
   */
  private async handleGetTable(args: any) {
    try {
      if (!args?.table_name) {
        throw new McpError(ErrorCode.InvalidParams, 'Table name is required');
      }
      const url = `${this.getBaseUrl()}/sap/bc/adt/ddic/tables/${args.table_name}/source/main`;
      const data = await this.makeAdtRequest(url, 'GET', 30000);

      // const url_appends = `${this.getBaseUrl()}/sap/bc/adt/ddic/tables/${args.table_name}/enhancement/elements`;
      // const data_appends = await this.makeAdtRequest(url, 'GET', 30000);

      
      return {
        content: [{
          type: 'text',
          // text: data + data_appends
          text: data
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }

  /**
   * Handles the 'GetStructure' tool request.
   * @private
   * @param {any} args The arguments passed to the tool.
   * @returns {Promise<object>} A Promise that resolves with the tool's result.
   */
  private async handleGetStructure(args: any) {
    try {
      if (!args?.structure_name) {
        throw new McpError(ErrorCode.InvalidParams, 'Structure name is required');
      }
      const url = `${this.getBaseUrl()}/sap/bc/adt/ddic/structures/${args.structure_name}/source/main`;
      const data = await this.makeAdtRequest(url, 'GET', 30000);
      
      return {
        content: [{
          type: 'text',
          text: data
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }

  /**
   * Handles the 'GetTableContents' tool request.
   * @private
   * @param {any} args The arguments passed to the tool.
   * @returns {Promise<object>} A Promise that resolves with the tool's result.
   */
  private async handleGetTableContents(args: any) {
    try {
      if (!args?.table_name) {
        throw new McpError(ErrorCode.InvalidParams, 'Table name is required');
      }
      const maxRows = args.max_rows || 100;
      //NOTE: This service requires a custom service implementation
      const url = `${this.getBaseUrl()}/z_mcp_abap_adt/z_tablecontent/${args.table_name}?maxRows=${maxRows}`;
      const data = await this.makeAdtRequest(url, 'GET', 30000);
      return {
        content: [{
          type: 'text',
          text: data
        }]
      };
    } catch (error) {
      // Specific error message for GetTableContents since it requires custom implementation
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Tool not available, Service /z_mcp_abap_adt/z_tablecontent not implemented. Please visit: https://community.sap.com/t5/application-development-blog-posts/how-to-use-rfc-read-table-from-javascript-via-webservice/ba-p/13172358`
        }]
      };
    }
  }

  /**
   * Handles the 'GetPackage' tool request.
   * @private
   * @param {any} args The arguments passed to the tool.
   * @returns {Promise<object>} A Promise that resolves with the tool's result.
   */
  private async handleGetPackage(args: any) {
    try {
      if (!args?.package_name) {
        throw new McpError(ErrorCode.InvalidParams, 'Package name is required');
      }
      const url = `${this.getBaseUrl()}/sap/bc/adt/repository/nodestructure?parent_name=${args.package_name}&parent_tech_name=${args.package_name}&parent_type=DEVC%2FK&withShortDescriptions=true/`;
      const data = await this.makeAdtRequest(url, 'GET', 30000);
      return {
        content: [{
          type: 'text',
          text: data
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }

  /**
   * Handles the 'GetInclude' tool request.
   * @private
   * @param {any} args The arguments passed to the tool.
   * @returns {Promise<object>} A Promise that resolves with the tool's result.
   */
  private async handleGetInclude(args: any) {
    try {
      if (!args?.include_name) {
        throw new McpError(ErrorCode.InvalidParams, 'Include name is required');
      }
      const url = `${this.getBaseUrl()}/sap/bc/adt/programs/includes/${args.include_name}/source/main`;
      const data = await this.makeAdtRequest(url, 'GET', 30000);
      return {
        content: [{
          type: 'text',
          text: data
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }

  /**
   * Handles the 'GetTypeInfo' tool request.
   * @private
   * @param {any} args The arguments passed to the tool.
   * @returns {Promise<object>} A Promise that resolves with the tool's result.
   */
  private async handleGetTypeInfo(args: any) {
    try {
      if (!args?.type_name) {
        throw new McpError(ErrorCode.InvalidParams, 'Type name is required');
      }
      const url = `${this.getBaseUrl()}/sap/bc/adt/ddic/domains/${args.type_name}/source/main`;
      const data = await this.makeAdtRequest(url, 'GET', 30000);
      return {
        content: [{
          type: 'text',
          text: data
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }

  /**
   * Handles the 'SearchObject' tool request.
   * @private
   * @param {any} args The arguments passed to the tool.
   * @returns {Promise<object>} A Promise that resolves with the tool's result.
   */
  private async handleSearchObject(args: any) {
    try {
      if (!args?.query) {
        throw new McpError(ErrorCode.InvalidParams, 'Search query is required');
      }
      const maxResults = args.maxResults || 100;
      const url = `${this.getBaseUrl()}/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=${args.query}*&maxResults=${maxResults}`;
      const data = await this.makeAdtRequest(url, 'GET', 30000);
      return {
        content: [{
          type: 'text',
          text: data
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
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
