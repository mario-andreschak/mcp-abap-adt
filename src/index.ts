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
import { handleGetIncludesList } from "./handlers/handleGetIncludesList";
import { handleGetTypeInfo } from "./handlers/handleGetTypeInfo";
import { handleGetInterface } from "./handlers/handleGetInterface";
import { handleGetTransaction } from "./handlers/handleGetTransaction";
import { handleSearchObject } from "./handlers/handleSearchObject";
import { handleGetEnhancements } from "./handlers/handleGetEnhancements";
import { handleGetSqlQuery } from "./handlers/handleGetSqlQuery";

// Import shared utility functions and types
import {
  getBaseUrl,
  getAuthHeaders,
  createAxiosInstance,
  makeAdtRequest,
  return_error,
  return_response,
} from "./lib/utils";

// Import logger
import { logger } from "./lib/logger";

// --- ENV FILE LOADING LOGIC ---
import fs from "fs";

/**
 * Parses command line arguments to find env file path
 * Supports both formats:
 * 1. --env=/path/to/.env
 * 2. --env /path/to/.env
 */
function parseEnvArg(): string | undefined {
  const args = process.argv;
  for (let i = 0; i < args.length; i++) {
    // Format: --env=/path/to/.env
    if (args[i].startsWith("--env=")) {
      return args[i].slice("--env=".length);
    }
    // Format: --env /path/to/.env
    else if (args[i] === "--env" && i + 1 < args.length) {
      return args[i + 1];
    }
  }
  return undefined;
}

// Find .env file path from arguments
let envFilePath = parseEnvArg();

// If no --env provided, try default locations
if (!envFilePath) {
  // List of possible default locations, in order of preference
  const possiblePaths = [
    // 1. .env in current working directory
    path.resolve(process.cwd(), '.env'),
    // 2. .env in project root (relative to dist/index.js)
    path.resolve(__dirname, "../.env")
  ];
  
  // Find the first existing .env file
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      envFilePath = possiblePath;
      process.stderr.write(`[MCP-ENV] No --env specified, using found .env: ${envFilePath}\n`);
      break;
    }
  }
  
  // If still not found, default to project root
  if (!envFilePath) {
    envFilePath = path.resolve(__dirname, "../.env");
    process.stderr.write(`[MCP-ENV] WARNING: No .env file found, will use path: ${envFilePath}\n`);
  }
}

// Always convert to absolute path
if (!path.isAbsolute(envFilePath)) {
  envFilePath = path.resolve(process.cwd(), envFilePath);
}

// Log the path being used
process.stderr.write(`[MCP-ENV] Using .env path: ${envFilePath}\n`);

// Load environment variables from the .env file
if (fs.existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath });
  process.stderr.write(`[MCP-ENV] Successfully loaded environment from: ${envFilePath}\n`);
} else {
  logger.error(".env file not found at provided path", { path: envFilePath });
  process.stderr.write(`ERROR: .env file not found at: ${envFilePath}\n`);
  process.exit(1);
}
// --- END ENV FILE LOADING LOGIC ---

// Debug: Log loaded SAP_URL and SAP_CLIENT using the MCP-compatible logger
logger.info("SAP configuration loaded", {
  type: "CONFIG_INFO",
  SAP_URL: process.env.SAP_URL,
  SAP_CLIENT: process.env.SAP_CLIENT || "(not set)",
  SAP_AUTH_TYPE: process.env.SAP_AUTH_TYPE || "(not set)",
  SAP_JWT_TOKEN: process.env.SAP_JWT_TOKEN ? "[set]" : "(not set)",
  ENV_PATH: envFilePath,
  CWD: process.cwd(),
  DIRNAME: __dirname,
});

// Interface for SAP configuration
export interface SapConfig {
  url: string;
  client?: string; // Made optional since it's not needed for JWT
  // Authentication options
  authType: "basic" | "jwt";
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
  // Clean all environment variables from comments (everything after # symbol)
  const rawUrl = process.env.SAP_URL;
  const url = rawUrl ? rawUrl.split('#')[0].trim() : rawUrl;
  const rawClient = process.env.SAP_CLIENT;
  const client = rawClient ? rawClient.split('#')[0].trim() : rawClient;
  const rawAuthType = process.env.SAP_AUTH_TYPE || "basic";
  const authType = rawAuthType.split('#')[0].trim();

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
    authType: authType === "xsuaa" ? "jwt" : (authType as "basic" | "jwt"),
  };

  // Add client only if it's provided
  if (client) {
    config.client = client;
  }

  // For basic auth, username and password are required
  if (authType === "basic") {
    const rawUsername = process.env.SAP_USERNAME;
    const username = rawUsername ? rawUsername.split('#')[0].trim() : rawUsername;
    const rawPassword = process.env.SAP_PASSWORD;
    const password = rawPassword ? rawPassword.split('#')[0].trim() : rawPassword;

    if (!username || !password) {
      throw new Error(
        `Basic authentication requires username and password. Missing variables:\n- SAP_USERNAME\n- SAP_PASSWORD`
      );
    }

    config.username = username;
    config.password = password;
  }
  // For JWT, the token is required
  else if (authType === "xsuaa" || authType === "jwt") {
    const rawJwtToken = process.env.SAP_JWT_TOKEN;
    const jwtToken = rawJwtToken ? rawJwtToken.split('#')[0].trim() : rawJwtToken;

    if (!jwtToken) {
      throw new Error(
        `JWT authentication requires a token. Missing variable:\n- SAP_JWT_TOKEN`
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
            description: "Retrieve ABAP program source code. Returns only the main program source code without includes or enhancements. Use GetIncludesList to get all includes, or GetEnhancements with include_nested=true for comprehensive enhancement analysis.",
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
            description: "📄 SINGLE INCLUDE SOURCE: Retrieve source code of a specific ABAP include file. Returns only the include's own source code without enhancements or nested analysis. Use GetEnhancements for enhancement analysis or GetIncludesList for complete include hierarchy.",
            inputSchema: {
              type: "object",
              properties: {
                include_name: {
                  type: "string",
                  description: "Name of the specific ABAP Include to retrieve",
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
          {
            name: "GetEnhancements",
            description: "🔍 ENHANCEMENT ANALYSIS: Retrieve and analyze enhancement implementations in ABAP programs or includes. Automatically detects object type and extracts enhancement source code. Use include_nested=true for COMPREHENSIVE RECURSIVE SEARCH across all nested includes - this finds ALL enhancements in the entire program hierarchy.",
            inputSchema: {
              type: "object",
              properties: {
                object_name: {
                  type: "string",
                  description: "Name of the ABAP program or include (e.g., 'RM07DOCS' for program, 'RM07DOCS_F01' for include)",
                },
                program: {
                  type: "string",
                  description: "Optional: For includes, manually specify the parent program name if automatic context detection fails (e.g., 'SAPMV45A')",
                },
                include_nested: {
                  type: "boolean",
                  description: "⭐ RECURSIVE ENHANCEMENT SEARCH: If true, performs comprehensive analysis - searches for enhancements in the main object AND all nested includes recursively. Perfect for complete enhancement audit of entire program hierarchy. Default is false (single object only).",
                },
              },
              required: ["object_name"],
            },
          },
          {
            name: "GetSqlQuery",
            description: "Execute freestyle SQL queries via SAP ADT Data Preview API. Supports SELECT, WITH statements and other read-only SQL operations.",
            inputSchema: {
              type: "object",
              properties: {
                sql_query: {
                  type: "string",
                  description: "SQL query to execute (e.g., 'SELECT * FROM mara WHERE matnr LIKE 'TEST%'')",
                },
                row_number: {
                  type: "number",
                  description: "Maximum number of rows to return",
                  default: 100,
                },
              },
              required: ["sql_query"],
            },
          },
          {
            name: "GetIncludesList",
            description: "📋 INCLUDE INVENTORY: Recursively discover and list ALL include files within an ABAP program or include. Performs code analysis to find include statements and builds a complete hierarchy. Use this when you need to understand the program structure or get a list of all includes (without their source code or enhancements).",
            inputSchema: {
              type: "object",
              properties: {
                object_name: {
                  type: "string",
                  description: "Name of the ABAP program or include to analyze for nested includes",
                },
                object_type: {
                  type: "string",
                  enum: ["program", "include"],
                  description: "Type of the ABAP object (program or include)",
                },
              },
              required: ["object_name", "object_type"],
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
        case "GetEnhancements":
          return await handleGetEnhancements(request.params.arguments);
        case "GetSqlQuery":
          return await handleGetSqlQuery(request.params.arguments);
        case "GetIncludesList":
          return await handleGetIncludesList(request.params.arguments);
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
