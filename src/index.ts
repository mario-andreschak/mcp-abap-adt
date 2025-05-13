#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import path from "path";
import dotenv from "dotenv";

// Import handler functions
import { handleGetProgram } from "./handlers/handleGetProgram";
import { handleGetClass } from "./handlers/handleGetClass";
import { handleGetFunctionGroup } from "./handlers/handleGetFunctionGroup";
import { handleGetFunction } from "./handlers/handleGetFunction";
import { handleGetTable } from "./handlers/handleGetTable";
import { handleGetStructure } from "./handlers/handleGetStructure";
import { handleGetTableContents } from "./handlers/handleGetTableContents";
import { handleGetPackage } from "./handlers/handleGetPackage";
import { handleGetInclude } from "./handlers/handleGetInclude";
import { handleGetTypeInfo } from "./handlers/handleGetTypeInfo";
import { handleGetInterface } from "./handlers/handleGetInterface";
import { handleGetTransaction } from "./handlers/handleGetTransaction";
import { handleSearchObject } from "./handlers/handleSearchObject";

// Import shared utility functions and types
import {
  getBaseUrl,
  getAuthHeaders,
  createAxiosInstance,
  makeAdtRequest,
  return_error,
  return_response,
} from "./lib/utils";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Debug: Log loaded SAP_URL and SAP_CLIENT for troubleshooting in JSON format for MCP compatibility
if (process.env.DEBUG === "true") {
  console.log(
    JSON.stringify({
      type: "CONFIG_INFO",
      message: "SAP configuration loaded",
      SAP_URL: process.env.SAP_URL,
      SAP_CLIENT: process.env.SAP_CLIENT || "(not set)",
    })
  );
}

// Interface for SAP configuration
export interface SapConfig {
  url: string;
  client?: string; // Made optional since it's not needed for XSUAA
  // Authentication options
  authType: "basic" | "xsuaa";
  username?: string;
  password?: string;
  jwtToken?: string;
}

/**
 * Retrieves SAP configuration from environment variables.
 *
 * @returns {SapConfig} The SAP configuration object.
 * @throws {Error} If any required environment variable is missing.
 */
export function getConfig(): SapConfig {
  const url = process.env.SAP_URL;
  const client = process.env.SAP_CLIENT;
  const authType = process.env.SAP_AUTH_TYPE || "basic";

  // Enhanced check for SAP_URL
  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error(
      `Missing or invalid SAP_URL. Got: '${url}'.\nRequired variables:\n- SAP_URL (must be a valid URL, e.g. https://<host>)\n- SAP_AUTH_TYPE (optional, defaults to 'basic')`
    );
  }

  // Client is only required for basic auth
  if (authType === "basic" && !client) {
    throw new Error(
      `Missing required environment variable: SAP_CLIENT. This is required for basic authentication.`
    );
  }

  // Config object
  const config: SapConfig = {
    url,
    authType: authType as "basic" | "xsuaa",
  };

  // Add client only if it's provided
  if (client) {
    config.client = client;
  }

  // For basic auth, username and password are required
  if (authType === "basic") {
    const username = process.env.SAP_USERNAME;
    const password = process.env.SAP_PASSWORD;

    if (!username || !password) {
      throw new Error(
        `Basic authentication requires username and password. Missing variables:\n- SAP_USERNAME\n- SAP_PASSWORD`
      );
    }

    config.username = username;
    config.password = password;
  }
  // For XSUAA/JWT, the token is required
  else if (authType === "xsuaa") {
    const jwtToken = process.env.SAP_JWT_TOKEN;

    if (!jwtToken) {
      throw new Error(
        `JWT/XSUAA authentication requires a token. Missing variable:\n- SAP_JWT_TOKEN`
      );
    }
    config.jwtToken = jwtToken;
  }

  return config;
}

/**
 * Server class for interacting with ABAP systems via ADT.
 */
export class mcp_abap_adt_server {
  private server: Server; // Instance of the MCP server
  private sapConfig: SapConfig; // SAP configuration

  /**
   * Constructor for the mcp_abap_adt_server class.
   */
  constructor() {
    this.sapConfig = getConfig(); // Load SAP configuration
    this.server = new Server( // Initialize the MCP server
      {
        name: "mcp-abap-adt", // Server name
        version: "0.1.0", // Server version
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
        tools: [
          // Define available tools
          {
            name: "GetProgram",
            description: "Retrieve ABAP program source code",
            inputSchema: {
              type: "object",
              properties: {
                program_name: {
                  type: "string",
                  description: "Name of the ABAP program",
                },
              },
              required: ["program_name"],
            },
          },
          {
            name: "GetClass",
            description: "Retrieve ABAP class source code",
            inputSchema: {
              type: "object",
              properties: {
                class_name: {
                  type: "string",
                  description: "Name of the ABAP class",
                },
              },
              required: ["class_name"],
            },
          },
          {
            name: "GetFunctionGroup",
            description: "Retrieve ABAP Function Group source code",
            inputSchema: {
              type: "object",
              properties: {
                function_group: {
                  type: "string",
                  description: "Name of the function module",
                },
              },
              required: ["function_group"],
            },
          },
          {
            name: "GetFunction",
            description: "Retrieve ABAP Function Module source code",
            inputSchema: {
              type: "object",
              properties: {
                function_name: {
                  type: "string",
                  description: "Name of the function module",
                },
                function_group: {
                  type: "string",
                  description: "Name of the function group",
                },
              },
              required: ["function_name", "function_group"],
            },
          },
          {
            name: "GetStructure",
            description: "Retrieve ABAP Structure",
            inputSchema: {
              type: "object",
              properties: {
                structure_name: {
                  type: "string",
                  description: "Name of the ABAP Structure",
                },
              },
              required: ["structure_name"],
            },
          },
          {
            name: "GetTable",
            description: "Retrieve ABAP table structure",
            inputSchema: {
              type: "object",
              properties: {
                table_name: {
                  type: "string",
                  description: "Name of the ABAP table",
                },
              },
              required: ["table_name"],
            },
          },
          {
            name: "GetTableContents",
            description: "Retrieve contents of an ABAP table",
            inputSchema: {
              type: "object",
              properties: {
                table_name: {
                  type: "string",
                  description: "Name of the ABAP table",
                },
                max_rows: {
                  type: "number",
                  description: "Maximum number of rows to retrieve",
                  default: 100,
                },
              },
              required: ["table_name"],
            },
          },
          {
            name: "GetPackage",
            description: "Retrieve ABAP package details",
            inputSchema: {
              type: "object",
              properties: {
                package_name: {
                  type: "string",
                  description: "Name of the ABAP package",
                },
              },
              required: ["package_name"],
            },
          },
          {
            name: "GetTypeInfo",
            description: "Retrieve ABAP type information",
            inputSchema: {
              type: "object",
              properties: {
                type_name: {
                  type: "string",
                  description: "Name of the ABAP type",
                },
              },
              required: ["type_name"],
            },
          },
          {
            name: "GetInclude",
            description: "Retrieve ABAP Include Source Code",
            inputSchema: {
              type: "object",
              properties: {
                include_name: {
                  type: "string",
                  description: "Name of the ABAP Include",
                },
              },
              required: ["include_name"],
            },
          },
          {
            name: "SearchObject",
            description: "Search for ABAP objects using quick search",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query string",
                },
                maxResults: {
                  type: "number",
                  description: "Maximum number of results to return",
                  default: 100,
                },
              },
              required: ["query"],
            },
          },
          {
            name: "GetTransaction",
            description: "Retrieve ABAP transaction details",
            inputSchema: {
              type: "object",
              properties: {
                transaction_name: {
                  type: "string",
                  description: "Name of the ABAP transaction",
                },
              },
              required: ["transaction_name"],
            },
          },
          {
            name: "GetInterface",
            description: "Retrieve ABAP interface source code",
            inputSchema: {
              type: "object",
              properties: {
                interface_name: {
                  type: "string",
                  description: "Name of the ABAP interface",
                },
              },
              required: ["interface_name"],
            },
          },
        ],
      };
    });

    // Handler for CallToolRequest
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case "GetProgram":
          return await handleGetProgram(request.params.arguments);
        case "GetClass":
          return await handleGetClass(request.params.arguments);
        case "GetFunction":
          return await handleGetFunction(request.params.arguments);
        case "GetFunctionGroup":
          return await handleGetFunctionGroup(request.params.arguments);
        case "GetStructure":
          return await handleGetStructure(request.params.arguments);
        case "GetTable":
          return await handleGetTable(request.params.arguments);
        case "GetTableContents":
          return await handleGetTableContents(request.params.arguments);
        case "GetPackage":
          return await handleGetPackage(request.params.arguments);
        case "GetTypeInfo":
          return await handleGetTypeInfo(request.params.arguments);
        case "GetInclude":
          return await handleGetInclude(request.params.arguments);
        case "SearchObject":
          return await handleSearchObject(request.params.arguments);
        case "GetInterface":
          return await handleGetInterface(request.params.arguments);
        case "GetTransaction":
          return await handleGetTransaction(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });

    // Handle server shutdown on SIGINT (Ctrl+C)
    process.on("SIGINT", async () => {
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
