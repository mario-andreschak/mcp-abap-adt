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
          },
          {
            name: 'ActivationGetInactiveObjects',
            description: 'Get inactive objects',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'DoSyntaxCheck',
            description: 'Perform syntax check',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'ObjectClassificationSystemGetClassifications',
            description: 'Get object classifications',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'AbapDictionaryGetDataElement',
            description: 'Get ABAP Dictionary data element',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name of the data element'
                }
              },
              required: ['name']
            }
          },
          {
            name: 'AbapDictionaryGetDomain',
            description: 'Get ABAP Dictionary domain',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name of the domain'
                }
              },
              required: ['name']
            }
          },
          {
            name: 'AbapDictionaryGetStructure',
            description: 'Get ABAP Dictionary structure',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name of the structure'
                }
              },
              required: ['name']
            }
          },
          {
            name: 'TypeGroupsGetTypeGroups',
            description: 'Get type groups',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'AbapExternalViewsGetViews',
            description: 'Get ABAP external views',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'DebuggerGetDebugger',
            description: 'Get debugger information',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'DebuggerGetDebuggerActions',
            description: 'Get debugger actions',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'DebuggerGetBreakpoints',
            description: 'Get debugger breakpoints',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'DebuggerGetBreakpointCondition',
            description: 'Get debugger breakpoint condition',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'DebuggerGetStatementsForBreakpoints',
            description: 'Get statements for breakpoints',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'DebuggerGetBreakpointValidation',
            description: 'Get breakpoint validation',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'DebuggerGetDebuggerListeners',
            description: 'Get debugger listeners',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'DebuggerGetSystemAreas',
            description: 'Get debugger system areas',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'DebuggerGetDebuggerVariables',
            description: 'Get debugger variables',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'DebuggerGetDebuggerWatchpoints',
            description: 'Get debugger watchpoints',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'EnhancementsGetEnhancementImplementation',
            description: 'Get enhancement implementation',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'EnhancementsGetEnhancementSpot',
            description: 'Get enhancement spot',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'FunctionGroupsFunctionsFunctionGroupIncludesGetFunctionGroups',
            description: 'Get function groups',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'MessageClassesGetMessageClasses',
            description: 'Get message classes',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'ClassesAndInterfacesGetClasses',
            description: 'Get classes',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'ClassesAndInterfacesGetInterfaces',
            description: 'Get interfaces',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'PackagesGetPackageSettings',
            description: 'Get package settings',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'ProgramsGetIncludes',
            description: 'Get program includes',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'ProgramsGetPrograms',
            description: 'Get programs',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'RepositoryInformationGetExecutableObjects',
            description: 'Get executable objects',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'RepositoryInformationGetExecutableObjectTypes',
            description: 'Get executable object types',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'RepositoryInformationGetFullNameMapping',
            description: 'Get full name mapping',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'RepositoryInformationGetMessageSearch',
            description: 'Get message search',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'RepositoryInformationGetMetaData',
            description: 'Get metadata',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'RepositoryInformationGetObjectTypes',
            description: 'Get object types',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'RepositoryInformationGetPropertyValues',
            description: 'Get property values',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'RepositoryInformationGetReleaseStates',
            description: 'Get release states',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'RepositoryInformationGetSearch',
            description: 'Get search',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'RepositoryInformationGetUsageReferences',
            description: 'Get usage references',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'RepositoryInformationGetUsageSnippets',
            description: 'Get usage snippets',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'RepositoryInformationGetWhereUsed',
            description: 'Get where used',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'RepositoryInformationGetNodePath',
            description: 'Get node path',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'RepositoryInformationGetNodeStructure',
            description: 'Get node structure',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'RepositoryInformationGetObjectStructure',
            description: 'Get object structure',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'RepositoryInformationGetTypeStructure',
            description: 'Get type structure',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'ClientGetClient',
            description: 'Get client',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'SystemInformationGetInstalledComponents',
            description: 'Get installed components',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'SystemInformationGetSystemInformation',
            description: 'Get system information',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'SystemLandscapeGetSystemLandscape',
            description: 'Get system landscape',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'UserGetUser',
            description: 'Get user',
            inputSchema: {
              type: 'object',
              properties: {}
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
        case 'ActivationGetInactiveObjects':
          return await this.handleActivationGetInactiveObjects();
        case 'DoSyntaxCheck':
          return await this.handleDoSyntaxCheck();
        case 'ObjectClassificationSystemGetClassifications':
          return await this.handleObjectClassificationSystemGetClassifications();
        case 'AbapDictionaryGetDataElement':
          return await this.handleAbapDictionaryGetDataElement(request.params.arguments);
        case 'AbapDictionaryGetDomain':
          return await this.handleAbapDictionaryGetDomain(request.params.arguments);
        case 'AbapDictionaryGetStructure':
          return await this.handleAbapDictionaryGetStructure(request.params.arguments);
        case 'TypeGroupsGetTypeGroups':
          return await this.handleTypeGroupsGetTypeGroups();
        case 'AbapExternalViewsGetViews':
          return await this.handleAbapExternalViewsGetViews();
        case 'DebuggerGetDebugger':
          return await this.handleDebuggerGetDebugger();
        case 'DebuggerGetDebuggerActions':
          return await this.handleDebuggerGetDebuggerActions();
        case 'DebuggerGetBreakpoints':
          return await this.handleDebuggerGetBreakpoints();
        case 'DebuggerGetBreakpointCondition':
          return await this.handleDebuggerGetBreakpointCondition();
        case 'DebuggerGetStatementsForBreakpoints':
          return await this.handleDebuggerGetStatementsForBreakpoints();
        case 'DebuggerGetBreakpointValidation':
          return await this.handleDebuggerGetBreakpointValidation();
        case 'DebuggerGetDebuggerListeners':
          return await this.handleDebuggerGetDebuggerListeners();
        case 'DebuggerGetSystemAreas':
          return await this.handleDebuggerGetSystemAreas();
        case 'DebuggerGetDebuggerVariables':
          return await this.handleDebuggerGetDebuggerVariables();
        case 'DebuggerGetDebuggerWatchpoints':
          return await this.handleDebuggerGetDebuggerWatchpoints();
        case 'EnhancementsGetEnhancementImplementation':
          return await this.handleEnhancementsGetEnhancementImplementation();
        case 'EnhancementsGetEnhancementSpot':
          return await this.handleEnhancementsGetEnhancementSpot();
        case 'FunctionGroupsFunctionsFunctionGroupIncludesGetFunctionGroups':
          return await this.handleFunctionGroupsFunctionsFunctionGroupIncludesGetFunctionGroups();
        case 'MessageClassesGetMessageClasses':
          return await this.handleMessageClassesGetMessageClasses();
        case 'ClassesAndInterfacesGetClasses':
          return await this.handleClassesAndInterfacesGetClasses();
        case 'ClassesAndInterfacesGetInterfaces':
          return await this.handleClassesAndInterfacesGetInterfaces();
        case 'PackagesGetPackageSettings':
          return await this.handlePackagesGetPackageSettings();
        case 'ProgramsGetIncludes':
          return await this.handleProgramsGetIncludes();
        case 'ProgramsGetPrograms':
          return await this.handleProgramsGetPrograms();
        case 'RepositoryInformationGetExecutableObjects':
          return await this.handleRepositoryInformationGetExecutableObjects();
        case 'RepositoryInformationGetExecutableObjectTypes':
          return await this.handleRepositoryInformationGetExecutableObjectTypes();
        case 'RepositoryInformationGetFullNameMapping':
          return await this.handleRepositoryInformationGetFullNameMapping();
        case 'RepositoryInformationGetMessageSearch':
          return await this.handleRepositoryInformationGetMessageSearch();
        case 'RepositoryInformationGetMetaData':
          return await this.handleRepositoryInformationGetMetaData();
        case 'RepositoryInformationGetObjectTypes':
          return await this.handleRepositoryInformationGetObjectTypes();
        case 'RepositoryInformationGetPropertyValues':
          return await this.handleRepositoryInformationGetPropertyValues();
        case 'RepositoryInformationGetReleaseStates':
          return await this.handleRepositoryInformationGetReleaseStates();
        case 'RepositoryInformationGetSearch':
          return await this.handleRepositoryInformationGetSearch();
        case 'RepositoryInformationGetUsageReferences':
          return await this.handleRepositoryInformationGetUsageReferences();
        case 'RepositoryInformationGetUsageSnippets':
          return await this.handleRepositoryInformationGetUsageSnippets();
        case 'RepositoryInformationGetWhereUsed':
          return await this.handleRepositoryInformationGetWhereUsed();
        case 'RepositoryInformationGetNodePath':
          return await this.handleRepositoryInformationGetNodePath();
        case 'RepositoryInformationGetNodeStructure':
          return await this.handleRepositoryInformationGetNodeStructure();
        case 'RepositoryInformationGetObjectStructure':
          return await this.handleRepositoryInformationGetObjectStructure();
        case 'RepositoryInformationGetTypeStructure':
          return await this.handleRepositoryInformationGetTypeStructure();
        case 'ClientGetClient':
          return await this.handleClientGetClient();
        case 'SystemInformationGetInstalledComponents':
          return await this.handleSystemInformationGetInstalledComponents();
        case 'SystemInformationGetSystemInformation':
          return await this.handleSystemInformationGetSystemInformation();
        case 'SystemLandscapeGetSystemLandscape':
          return await this.handleSystemLandscapeGetSystemLandscape();
        case 'UserGetUser':
          return await this.handleUserGetUser();
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

  private async handleActivationGetInactiveObjects() {
    log('Retrieving inactive objects');
    const url = `${this.getBaseUrl()}/sap/bc/adt/activation/inactiveobjects`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleDoSyntaxCheck() {
    log('Performing syntax check');
    const url = `${this.getBaseUrl()}/sap/bc/adt/checkruns`;
    const data = await this.makeAdtRequest(url, 'POST', 30000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleObjectClassificationSystemGetClassifications() {
    log('Retrieving object classifications');
    const url = `${this.getBaseUrl()}/sap/bc/adt/classifications`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleAbapDictionaryGetDataElement(args: any) {
    const name = this.validateArgs(args, 'AbapDictionaryGetDataElement', 'name');
    log(`Retrieving ABAP Dictionary data element: ${name}`);
    const url = `${this.getBaseUrl()}/sap/bc/adt/ddic/dataelements/${name}`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleAbapDictionaryGetDomain(args: any) {
    const name = this.validateArgs(args, 'AbapDictionaryGetDomain', 'name');
    log(`Retrieving ABAP Dictionary domain: ${name}`);
    const url = `${this.getBaseUrl()}/sap/bc/adt/ddic/domains/${name}`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleAbapDictionaryGetStructure(args: any) {
    const name = this.validateArgs(args, 'AbapDictionaryGetStructure', 'name');
    log(`Retrieving ABAP Dictionary structure: ${name}`);
    const url = `${this.getBaseUrl()}/sap/bc/adt/ddic/structures/${name}`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleTypeGroupsGetTypeGroups() {
    log('Retrieving type groups');
    const url = `${this.getBaseUrl()}/sap/bc/adt/ddic/typegroups`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleAbapExternalViewsGetViews() {
    log('Retrieving ABAP external views');
    const url = `${this.getBaseUrl()}/sap/bc/adt/ddic/views`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleDebuggerGetDebugger() {
    log('Retrieving debugger information');
    const url = `${this.getBaseUrl()}/sap/bc/adt/debugger`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleDebuggerGetDebuggerActions() {
    log('Retrieving debugger actions');
    const url = `${this.getBaseUrl()}/sap/bc/adt/debugger/actions`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleDebuggerGetBreakpoints() {
    log('Retrieving debugger breakpoints');
    const url = `${this.getBaseUrl()}/sap/bc/adt/debugger/breakpoints`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleDebuggerGetBreakpointCondition() {
    log('Retrieving debugger breakpoint condition');
    const url = `${this.getBaseUrl()}/sap/bc/adt/debugger/breakpoints/conditions`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleDebuggerGetStatementsForBreakpoints() {
    log('Retrieving statements for breakpoints');
    const url = `${this.getBaseUrl()}/sap/bc/adt/debugger/breakpoints/statements`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleDebuggerGetBreakpointValidation() {
    log('Retrieving breakpoint validation');
    const url = `${this.getBaseUrl()}/sap/bc/adt/debugger/breakpoints/validations`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleDebuggerGetDebuggerListeners() {
    log('Retrieving debugger listeners');
    const url = `${this.getBaseUrl()}/sap/bc/adt/debugger/listeners`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleDebuggerGetSystemAreas() {
    log('Retrieving debugger system areas');
    const url = `${this.getBaseUrl()}/sap/bc/adt/debugger/systemareas`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleDebuggerGetDebuggerVariables() {
    log('Retrieving debugger variables');
    const url = `${this.getBaseUrl()}/sap/bc/adt/debugger/variables`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleDebuggerGetDebuggerWatchpoints() {
    log('Retrieving debugger watchpoints');
    const url = `${this.getBaseUrl()}/sap/bc/adt/debugger/watchpoints`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleEnhancementsGetEnhancementImplementation() {
    log('Retrieving enhancement implementation');
    const url = `${this.getBaseUrl()}/sap/bc/adt/enhancements/enhoxh`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleEnhancementsGetEnhancementSpot() {
    log('Retrieving enhancement spot');
    const url = `${this.getBaseUrl()}/sap/bc/adt/enhancements/enhsxs`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleFunctionGroupsFunctionsFunctionGroupIncludesGetFunctionGroups() {
    log('Retrieving function groups');
    const url = `${this.getBaseUrl()}/sap/bc/adt/functions/groups`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleMessageClassesGetMessageClasses() {
    log('Retrieving message classes');
    const url = `${this.getBaseUrl()}/sap/bc/adt/messageclass`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleClassesAndInterfacesGetClasses() {
    log('Retrieving classes');
    const url = `${this.getBaseUrl()}/sap/bc/adt/oo/classes`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleClassesAndInterfacesGetInterfaces() {
    log('Retrieving interfaces');
    const url = `${this.getBaseUrl()}/sap/bc/adt/oo/interfaces`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handlePackagesGetPackageSettings() {
    log('Retrieving package settings');
    const url = `${this.getBaseUrl()}/sap/bc/adt/packages/settings`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleProgramsGetIncludes() {
    log('Retrieving program includes');
    const url = `${this.getBaseUrl()}/sap/bc/adt/programs/includes`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleProgramsGetPrograms() {
    log('Retrieving programs');
    const url = `${this.getBaseUrl()}/sap/bc/adt/programs/programs`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleRepositoryInformationGetExecutableObjects() {
    log('Retrieving executable objects');
    const url = `${this.getBaseUrl()}/sap/bc/adt/repository/informationsystem/executableObjects`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleRepositoryInformationGetExecutableObjectTypes() {
    log('Retrieving executable object types');
    const url = `${this.getBaseUrl()}/sap/bc/adt/repository/informationsystem/executableobjecttypes`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleRepositoryInformationGetFullNameMapping() {
    log('Retrieving full name mapping');
    const url = `${this.getBaseUrl()}/sap/bc/adt/repository/informationsystem/fullnamemapping`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleRepositoryInformationGetMessageSearch() {
    log('Retrieving message search');
    const url = `${this.getBaseUrl()}/sap/bc/adt/repository/informationsystem/messagesearch`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleRepositoryInformationGetMetaData() {
    log('Retrieving metadata');
    const url = `${this.getBaseUrl()}/sap/bc/adt/repository/informationsystem/metadata`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleRepositoryInformationGetObjectTypes() {
    log('Retrieving object types');
    const url = `${this.getBaseUrl()}/sap/bc/adt/repository/informationsystem/objecttypes`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleRepositoryInformationGetPropertyValues() {
    log('Retrieving property values');
    const url = `${this.getBaseUrl()}/sap/bc/adt/repository/informationsystem/properties/values`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleRepositoryInformationGetReleaseStates() {
    log('Retrieving release states');
    const url = `${this.getBaseUrl()}/sap/bc/adt/repository/informationsystem/releasestates`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleRepositoryInformationGetSearch() {
    log('Retrieving search');
    const url = `${this.getBaseUrl()}/sap/bc/adt/repository/informationsystem/search`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleRepositoryInformationGetUsageReferences() {
    log('Retrieving usage references');
    const url = `${this.getBaseUrl()}/sap/bc/adt/repository/informationsystem/usageReferences`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleRepositoryInformationGetUsageSnippets() {
    log('Retrieving usage snippets');
    const url = `${this.getBaseUrl()}/sap/bc/adt/repository/informationsystem/usageSnippets`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleRepositoryInformationGetWhereUsed() {
    log('Retrieving where used');
    const url = `${this.getBaseUrl()}/sap/bc/adt/repository/informationsystem/whereused`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleRepositoryInformationGetNodePath() {
    log('Retrieving node path');
    const url = `${this.getBaseUrl()}/sap/bc/adt/repository/nodepath`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleRepositoryInformationGetNodeStructure() {
    log('Retrieving node structure');
    const url = `${this.getBaseUrl()}/sap/bc/adt/repository/nodestructure`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleRepositoryInformationGetObjectStructure() {
    log('Retrieving object structure');
    const url = `${this.getBaseUrl()}/sap/bc/adt/repository/objectstructure`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleRepositoryInformationGetTypeStructure() {
    log('Retrieving type structure');
    const url = `${this.getBaseUrl()}/sap/bc/adt/repository/typestructure`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleClientGetClient() {
    log('Retrieving client information');
    const url = `${this.getBaseUrl()}/sap/bc/adt/system/clients`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleSystemInformationGetInstalledComponents() {
    log('Retrieving installed components');
    const url = `${this.getBaseUrl()}/sap/bc/adt/system/components`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleSystemInformationGetSystemInformation() {
    log('Retrieving system information');
    const url = `${this.getBaseUrl()}/sap/bc/adt/system/information`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleSystemLandscapeGetSystemLandscape() {
    log('Retrieving system landscape');
    const url = `${this.getBaseUrl()}/sap/bc/adt/system/landscape/servers`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async handleUserGetUser() {
    log('Retrieving user information');
    const url = `${this.getBaseUrl()}/sap/bc/adt/system/users`;
    const data = await this.makeAdtRequest(url, 'GET', 10000);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private validateArgs(args: any, toolName: string, ...requiredArgs: string[]) {
    log(`Validating arguments for ${toolName}`);
    if (typeof args !== 'object' || args === null) {
      const errorMessage = `Invalid arguments for ${toolName}`;
      log(`Error: ${errorMessage}`);
      throw new McpError(ErrorCode.InvalidParams, errorMessage);
    }
    for (const arg of requiredArgs) {
      if (typeof args[arg] !== 'string') {
        const errorMessage = `Missing or invalid ${arg} for ${toolName}`;
        log(`Error: ${errorMessage}`);
        throw new McpError(ErrorCode.InvalidParams, errorMessage);
      }
    }
    log(`Arguments for ${toolName} are valid`);
    return requiredArgs.length === 1 ? args[requiredArgs[0]] : args;
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
