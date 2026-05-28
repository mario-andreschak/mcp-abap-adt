#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import path from 'path';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { randomUUID } from 'crypto';

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

type TransportMode = 'stdio' | 'http';

function getTransportMode(): TransportMode {
  const mode = (process.env.MCP_TRANSPORT || process.env.TRANSPORT || 'stdio').toLowerCase();
  return mode === 'http' || mode === 'streamable-http' ? 'http' : 'stdio';
}

function isNotConnectedError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Not connected');
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
  private server: McpServer;  // Instance of the MCP server
  private sapConfig: SapConfig; // SAP configuration

  /**
   * Constructor for the mcp_abap_adt_server class.
   */
  constructor() {
    this.sapConfig = getConfig(); // Load SAP configuration
    this.server = this.createServer();
  }

  private createServer(): McpServer {
    const server = new McpServer(  // Initialize the MCP server
      {
        name: 'mcp-abap-adt', // Server name
        version: '0.1.0',       // Server version
      },
      {
        capabilities: {
          tools: {}, // Initially, no tools are registered
          logging: {}, // Advertise MCP logging support
        },
      }
    );

    this.setupHandlers(server); // Setup request handlers
    return server;
  }

  /**
   * Sets up request handlers for listing and calling tools.
   * @private
   */
  private setupHandlers(server: McpServer) {
    // Setup tool handlers

    // Handler for ListToolsRequest
    server.server.setRequestHandler(ListToolsRequestSchema, async () => {
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
          }
        ]
      };
    });

    // Handler for CallToolRequest
    server.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const toolName = request.params.name;
      const toolArgs = request.params.arguments ?? {};
      const headerSessionId = extra.requestInfo?.headers['mcp-session-id'];
      const normalizedSessionId = Array.isArray(headerSessionId) ? headerSessionId[0] : headerSessionId;
      const sessionId = extra.sessionId || normalizedSessionId;

      console.info(`[TOOL] Invoking ${toolName}`, toolArgs);
      if (server.isConnected()) {
        server.sendLoggingMessage(
          {
            level: 'info',
            logger: 'tool',
            data: {
              event: 'tool_invocation',
              toolName,
              arguments: toolArgs,
            },
          },
          sessionId,
        ).catch((error) => {
          if (isNotConnectedError(error)) {
            return;
          }
          console.error('Error sending tool invocation log:', error);
        });
      }

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

  }

  /**
   * Starts the MCP server and connects it to the transport.
   */
  async run() {
    const mode = getTransportMode();

    if (mode === 'http') {
      await this.runHttp();
      return;
    }

    await this.runStdio();
  }

  private async runStdio() {
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  private async runHttp() {
    const port = Number.parseInt(process.env.PORT || '8080', 10);

    if (Number.isNaN(port) || port <= 0) {
      throw new Error('PORT must be a valid positive integer when MCP_TRANSPORT=http');
    }

    const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();
    const closingTransports = new WeakSet<StreamableHTTPServerTransport>();

    process.on('SIGINT', async () => {
      const uniqueServers = new Set<McpServer>();
      for (const session of sessions.values()) {
        uniqueServers.add(session.server);
        await session.transport.close().catch(() => undefined);
      }

      for (const sessionServer of uniqueServers) {
        await sessionServer.close().catch(() => undefined);
      }

      process.exit(0);
    });

    const httpServer = createServer((req, res) => {
      const startedAt = Date.now();
      const method = req.method || 'UNKNOWN';
      const sessionIdHeader = req.headers['mcp-session-id'];
      const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
      let requestServer: McpServer | undefined;
      let requestSessionId: string | undefined = sessionId;
      const pathname = req.url
        ? new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname
        : '/';

      res.on('finish', () => {
        const durationMs = Date.now() - startedAt;
        console.log(`[HTTP] ${method} ${pathname} -> ${res.statusCode} (${durationMs}ms)`);

        if (pathname !== '/mcp') {
          return;
        }

        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warning' : 'info';
        if (!requestServer || !requestServer.isConnected()) {
          return;
        }

        requestServer.sendLoggingMessage(
          {
            level,
            logger: 'http',
            data: {
              method,
              path: pathname,
              statusCode: res.statusCode,
              durationMs,
            },
          },
          requestSessionId,
        ).catch((error) => {
          if (isNotConnectedError(error)) {
            return;
          }
          console.error('Error sending MCP logging message:', error);
        });
      });

      if (pathname === '/healthz') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      if (pathname === '/mcp') {
        const handleMcpRequest = async () => {
          if (sessionId) {
            const existingSession = sessions.get(sessionId);

            if (!existingSession) {
              res.writeHead(400, { 'content-type': 'application/json' });
              res.end(JSON.stringify({ error: 'Bad Request: Invalid or expired MCP session ID' }));
              return;
            }

            requestServer = existingSession.server;
            await existingSession.transport.handleRequest(req, res);
            return;
          }

          const sessionServer = this.createServer();
          const sessionTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (newSessionId) => {
              requestSessionId = newSessionId;
              sessions.set(newSessionId, { server: sessionServer, transport: sessionTransport });
            },
          });

          sessionTransport.onclose = () => {
            if (closingTransports.has(sessionTransport)) {
              return;
            }

            closingTransports.add(sessionTransport);
            const currentSessionId = sessionTransport.sessionId;
            if (currentSessionId) {
              sessions.delete(currentSessionId);
            }

            // Avoid calling sessionServer.close() here: transport.close() triggers onclose,
            // and calling close again can recurse through the same path.
          };

          requestServer = sessionServer;
          await sessionServer.connect(sessionTransport);
          await sessionTransport.handleRequest(req, res);
        };

        handleMcpRequest().catch((error) => {
          console.error('Error handling /mcp request:', error);
          if (!res.headersSent) {
            res.writeHead(500, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
          }
        });
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    });

    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(port, () => resolve());
    });
  }
}

// Create and run the server
export async function startServer() {
  const server = new mcp_abap_adt_server();
  await server.run();
}

const isMainModule = process.argv[1]
  ? require.main === module
  : false;

if (isMainModule) {
  startServer().catch(() => {
    process.exit(1);
  });
}
