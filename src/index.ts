#!/usr/bin/env node
import {
  McpServer,
  fromJsonSchema,
  type CallToolResult,
} from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
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
import { handleGetCDSView } from "./handlers/handleGetCDSView";
import { handleGetBehaviorDefinition } from "./handlers/handleGetBehaviorDefinition";
import { handleGetServiceDefinition } from "./handlers/handleGetServiceDefinition";
import {
  handleListICFHosts,
  handleListICFNodes,
  handleGetICFNode,
  handleCreateICFNode,
  handleActivateICFNode,
  handleDeleteICFNode,
  handleSetICFLogonData,
} from "./handlers/handleIcf";

// Import shared utility functions and types
import { MAX_PAGE_LINES, cleanup } from "./lib/utils";
import { withRequestSignal } from "./lib/network";

export { getConfig } from "./config";
export type { SapConfig } from "./config";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Shared schema fragments for every tool whose textual result is protected by
// the response byte cap. Runtime validation in lib/utils.ts matches these bounds.
export const PAGING_START_LINE = {
  type: "integer",
  minimum: 1,
  description:
    "1-based line number to start from (default 1). Beyond EOF returns an empty page with hasMore=false.",
};
export const PAGING_MAX_LINES = {
  type: "integer",
  minimum: 1,
  maximum: MAX_PAGE_LINES,
  description: `Maximum lines to return (1-${MAX_PAGE_LINES}). Omit to request the rest; the byte cap may return fewer lines.`,
};

export const PAGED_TEXT_TOOL_NAMES = [
  "GetProgram",
  "GetClass",
  "GetFunctionGroup",
  "GetFunction",
  "GetStructure",
  "GetTable",
  "GetTableContents",
  "GetPackage",
  "GetTypeInfo",
  "GetInclude",
  "SearchObject",
  "GetTransaction",
  "GetCDSView",
  "GetInterface",
  "GetBehaviorDefinition",
  "GetServiceDefinition",
] as const;

const PAGED_TEXT_TOOL_SET = new Set<string>(PAGED_TEXT_TOOL_NAMES);

export function addPagingSchemas(tools: any[]) {
  return tools.map((tool) => {
    if (!PAGED_TEXT_TOOL_SET.has(tool.name)) {
      return tool;
    }
    return {
      ...tool,
      inputSchema: {
        ...tool.inputSchema,
        properties: {
          ...tool.inputSchema.properties,
          startLine: PAGING_START_LINE,
          maxLines: PAGING_MAX_LINES,
        },
      },
    };
  });
}

const TOOL_DEFINITIONS = [
  // Define available tools
  {
    name: "GetProgram",
    description:
      "Retrieve ABAP program source code. For large programs, use startLine/maxLines to page through the source instead of retrieving it all at once.",
    inputSchema: {
      type: "object",
      properties: {
        program_name: {
          type: "string",
          description: "Name of the ABAP program",
        },
        startLine: PAGING_START_LINE,
        maxLines: PAGING_MAX_LINES,
      },
      required: ["program_name"],
    },
  },
  {
    name: "GetClass",
    description:
      "Retrieve ABAP class source code. For large classes, use startLine/maxLines to page through the source instead of retrieving it all at once.",
    inputSchema: {
      type: "object",
      properties: {
        class_name: {
          type: "string",
          description: "Name of the ABAP class",
        },
        startLine: PAGING_START_LINE,
        maxLines: PAGING_MAX_LINES,
      },
      required: ["class_name"],
    },
  },
  {
    name: "GetFunctionGroup",
    description:
      "Retrieve ABAP Function Group source code. For large function groups, use startLine/maxLines to page through the source instead of retrieving it all at once.",
    inputSchema: {
      type: "object",
      properties: {
        function_group: {
          type: "string",
          description: "Name of the function module",
        },
        startLine: PAGING_START_LINE,
        maxLines: PAGING_MAX_LINES,
      },
      required: ["function_group"],
    },
  },
  {
    name: "GetFunction",
    description:
      "Retrieve ABAP Function Module source code. For large function modules, use startLine/maxLines to page through the source instead of retrieving it all at once.",
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
        startLine: PAGING_START_LINE,
        maxLines: PAGING_MAX_LINES,
      },
      required: ["function_name", "function_group"],
    },
  },
  {
    name: "GetStructure",
    description:
      "Retrieve ABAP Structure. For large structures, use startLine/maxLines to page through the result instead of retrieving it all at once.",
    inputSchema: {
      type: "object",
      properties: {
        structure_name: {
          type: "string",
          description: "Name of the ABAP Structure",
        },
        startLine: PAGING_START_LINE,
        maxLines: PAGING_MAX_LINES,
      },
      required: ["structure_name"],
    },
  },
  {
    name: "GetTable",
    description:
      "Retrieve ABAP table structure. For large tables, use startLine/maxLines to page through the result instead of retrieving it all at once.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the ABAP table",
        },
        startLine: PAGING_START_LINE,
        maxLines: PAGING_MAX_LINES,
      },
      required: ["table_name"],
    },
  },
  {
    name: "GetTableContents",
    description:
      "Retrieve contents of an ABAP table. max_rows limits SAP rows; startLine/maxLines page the returned textual XML when its serialized size is still large.",
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
    description:
      "Retrieve ABAP package details. Use startLine/maxLines to page large serialized package listings.",
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
    description:
      "Retrieve ABAP type information. For large results, use startLine/maxLines to page through it instead of retrieving it all at once.",
    inputSchema: {
      type: "object",
      properties: {
        type_name: {
          type: "string",
          description: "Name of the ABAP type",
        },
        startLine: PAGING_START_LINE,
        maxLines: PAGING_MAX_LINES,
      },
      required: ["type_name"],
    },
  },
  {
    name: "GetInclude",
    description:
      "Retrieve ABAP Include Source Code. For large includes, use startLine/maxLines to page through the source instead of retrieving it all at once.",
    inputSchema: {
      type: "object",
      properties: {
        include_name: {
          type: "string",
          description: "Name of the ABAP Include",
        },
        startLine: PAGING_START_LINE,
        maxLines: PAGING_MAX_LINES,
      },
      required: ["include_name"],
    },
  },
  {
    name: "SearchObject",
    description:
      "Search for ABAP objects using quick search. maxResults limits matches; startLine/maxLines page the returned textual XML when its serialized size is still large.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query string (use * wildcard for partial match)",
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
    description:
      "Retrieve ABAP transaction details. For large results, use startLine/maxLines to page through it instead of retrieving it all at once.",
    inputSchema: {
      type: "object",
      properties: {
        transaction_name: {
          type: "string",
          description: "Name of the ABAP transaction",
        },
        startLine: PAGING_START_LINE,
        maxLines: PAGING_MAX_LINES,
      },
      required: ["transaction_name"],
    },
  },
  {
    name: "GetCDSView",
    description:
      "Retrieve CDS view (DDL source) source code. For large views, use startLine/maxLines to page through the source instead of retrieving it all at once.",
    inputSchema: {
      type: "object",
      properties: {
        cds_view_name: {
          type: "string",
          description:
            "Name of the CDS view (DDL source name, e.g. I_CURRENCY)",
        },
        startLine: PAGING_START_LINE,
        maxLines: PAGING_MAX_LINES,
      },
      required: ["cds_view_name"],
    },
  },
  {
    name: "GetInterface",
    description:
      "Retrieve ABAP interface source code. For large interfaces, use startLine/maxLines to page through the source instead of retrieving it all at once.",
    inputSchema: {
      type: "object",
      properties: {
        interface_name: {
          type: "string",
          description: "Name of the ABAP interface",
        },
        startLine: PAGING_START_LINE,
        maxLines: PAGING_MAX_LINES,
      },
      required: ["interface_name"],
    },
  },
  {
    name: "GetBehaviorDefinition",
    description:
      "Retrieve RAP Behavior Definition (BDEF) source code (requires ~NW 7.54 / S/4HANA). For large definitions, use startLine/maxLines to page through the source instead of retrieving it all at once.",
    inputSchema: {
      type: "object",
      properties: {
        behavior_definition_name: {
          type: "string",
          description: "Name of the RAP Behavior Definition (e.g. I_MY_ENTITY)",
        },
        startLine: PAGING_START_LINE,
        maxLines: PAGING_MAX_LINES,
      },
      required: ["behavior_definition_name"],
    },
  },
  {
    name: "GetServiceDefinition",
    description:
      "Retrieve RAP Service Definition (SRVD) source code (requires ~NW 7.54 / S/4HANA). For large definitions, use startLine/maxLines to page through the source instead of retrieving it all at once.",
    inputSchema: {
      type: "object",
      properties: {
        service_definition_name: {
          type: "string",
          description: "Name of the RAP Service Definition (e.g. Z_MY_SERVICE)",
        },
        startLine: PAGING_START_LINE,
        maxLines: PAGING_MAX_LINES,
      },
      required: ["service_definition_name"],
    },
  },
  {
    name: "ListICFHosts",
    description:
      "List all HTTP virtual hosts of the ICF tree (transaction SICF top level). Standard FMs of function group HTTPTREE (the official SICF API, also used by SAP's own mass-processing report RS_ICF_SERV_MASS_PROCESSING / class CL_ICF_SERVICE_PUBLICATION).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "ListICFNodes",
    description:
      "List all ICF service URL prefixes (like executing SICF with all hosts, or report RS_ICF_SERV_ADMIN_TASKS). Optionally filter by substring. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        url_contains: {
          type: "string",
          description: "Case-insensitive substring filter on the URL path (e.g. 'ZMCP'). Omit for all.",
        },
      },
      required: [],
    },
  },
  {
    name: "GetICFNode",
    description:
      "Read one ICF service node: activation state, handler class list, logon data (passwords masked) and node GUID for every path segment. Read-only inspection before create/modify/delete.",
    inputSchema: {
      type: "object",
      properties: {
        service_url: {
          type: "string",
          description: "Full ICF path, e.g. /sap/bc/zmyservice",
        },
        host: {
          type: "string",
          description: "Virtual host name (default DEFAULT_HOST).",
        },
      },
      required: ["service_url"],
    },
  },
  {
    name: "CreateICFNode",
    description:
      "Create an ICF (SICF) service node — equivalent to 'Create Service' in transaction SICF. Calls standard FM HTTPTREE_INSERT_NODE (function group HTTPTREE). Parent path must already exist; the last URL segment becomes the node name (max 15 chars, alphanumeric/underscore). A transport request is MANDATORY (creation is recorded via the transport system; headless calls fail without one). Handler class names are validated by SAP against IF_HTTP_EXTENSION implementations. Optionally require HTTPS or activate immediately.",
    inputSchema: {
      type: "object",
      properties: {
        service_url: {
          type: "string",
          description: "Full path of the NEW node, e.g. /sap/bc/zmyservice (parent /sap/bc must exist).",
        },
        description: {
          type: "string",
          description: "Service description text (mandatory in SICF, stored as node documentation).",
        },
        transport: {
          type: "string",
          description:
            "Open workbench request for the transport record (e.g. XZTK900002). MANDATORY — the standard FM cannot run headless without one.",
        },
        handlers: {
          type: "array",
          items: { type: "string" },
          description:
            "Handler class names implementing IF_HTTP_EXTENSION (SAP validates each; e.g. ZCL_JSON_HANDLER), called in listed order.",
        },
        https_only: {
          type: "boolean",
          description: "Require HTTPS for this service (PROTSEC='X').",
        },
        activate: {
          type: "boolean",
          description: "Activate the node right after creation (default false).",
        },
        package: {
          type: "string",
          description: "Optional development package; defaults to the parent node's package.",
        },
        host: {
          type: "string",
          description: "Virtual host name (default DEFAULT_HOST).",
        },
        language: {
          type: "string",
          description: "Documentation language key (default EN).",
        },
      },
      required: ["service_url", "description", "transport"],
    },
  },
  {
    name: "ActivateICFNode",
    description:
      "Activate or deactivate an ICF service node — equivalent to right-click 'Activate Service' in SICF. Calls standard FMs HTTP_ACTIVATE_NODE / HTTP_INACTIVATE_NODE (same API SAP's official mass-processing report uses). ICF activation state is client-independent and does not need a transport.",
    inputSchema: {
      type: "object",
      properties: {
        service_url: {
          type: "string",
          description: "Full ICF path, e.g. /sap/bc/zmyservice",
        },
        action: {
          type: "string",
          enum: ["activate", "deactivate"],
          description: "Default activate.",
        },
        expand_subnodes: {
          type: "boolean",
          description: "Activate/deactivate the whole subtree (EXPAND='X', default true).",
        },
        host: {
          type: "string",
          description: "Virtual host name (default DEFAULT_HOST).",
        },
      },
      required: ["service_url"],
    },
  },
  {
    name: "DeleteICFNode",
    description:
      "Delete an ICF service node — equivalent to 'Delete Node' in SICF. Calls standard FM HTTPTREE_DELETE_NODE. DESTRUCTIVE: requires confirm=true. KNOWN LIMITATION (SAP standard-code defect, verified on this system): the FM fails on headless channels because it never assigns its internal lock-order variable, so it tries to open a GUI transport dialog. If deletion fails for that reason the tool returns a structured explanation and the SICF GUI workaround.",
    inputSchema: {
      type: "object",
      properties: {
        service_url: {
          type: "string",
          description: "Full ICF path of the node to delete, e.g. /sap/bc/zmyservice",
        },
        confirm: {
          type: "boolean",
          description: "Must be true — deletion cannot be undone from this tool.",
        },
        transport: {
          type: "string",
          description: "Optional transport request to record the deletion.",
        },
        host: {
          type: "string",
          description: "Virtual host name (default DEFAULT_HOST).",
        },
      },
      required: ["service_url", "confirm"],
    },
  },
  {
    name: "SetICFLogonData",
    description:
      "Set the logon data of an ICF service node (user/client/password/logon required) — equivalent to the 'Logon Data' tab in SICF. Calls standard FM HTTP_SERVICE_SET_LOGON_DATA (internally cl_icf_tree=>set_logon_data). Password is never echoed back.",
    inputSchema: {
      type: "object",
      properties: {
        service_url: {
          type: "string",
          description: "Full ICF path, e.g. /sap/bc/zmyservice",
        },
        user: {
          type: "string",
          description: "Logon user for the service.",
        },
        password: {
          type: "string",
          description: "Logon password (sent to SAP, never echoed back).",
        },
        client: {
          type: "string",
          description: "Mandant for the service logon (optional).",
        },
        language: {
          type: "string",
          description: "Logon language key (optional).",
        },
        require_logon: {
          type: "boolean",
          description: "Mark logon data as mandatory (ICF_OBLIGATE_USER='X').",
        },
        host: {
          type: "string",
          description: "Virtual host name (default DEFAULT_HOST).",
        },
      },
      required: ["service_url"],
    },
  },
];

const HANDLERS: Record<string, (args: any) => Promise<any>> = {
  GetProgram: handleGetProgram,
  GetClass: handleGetClass,
  GetFunction: handleGetFunction,
  GetFunctionGroup: handleGetFunctionGroup,
  GetStructure: handleGetStructure,
  GetTable: handleGetTable,
  GetTableContents: handleGetTableContents,
  GetPackage: handleGetPackage,
  GetTypeInfo: handleGetTypeInfo,
  GetInclude: handleGetInclude,
  SearchObject: handleSearchObject,
  GetInterface: handleGetInterface,
  GetTransaction: handleGetTransaction,
  GetCDSView: handleGetCDSView,
  GetBehaviorDefinition: handleGetBehaviorDefinition,
  GetServiceDefinition: handleGetServiceDefinition,
  ListICFHosts: handleListICFHosts,
  ListICFNodes: handleListICFNodes,
  GetICFNode: handleGetICFNode,
  CreateICFNode: handleCreateICFNode,
  ActivateICFNode: handleActivateICFNode,
  DeleteICFNode: handleDeleteICFNode,
  SetICFLogonData: handleSetICFLogonData,
};

/**
 * ICF write tools mutate the SAP system's ICF tree (create/activate/delete/
 * logon data). They intentionally do NOT get the read-only annotation the
 * classic read tools get.
 */
const ICF_WRITE_TOOLS = new Set([
  "CreateICFNode",
  "ActivateICFNode",
  "DeleteICFNode",
  "SetICFLogonData",
]);

export function createServer(): McpServer {
  const server = new McpServer({
    name: "mcp-abap-adt",
    version: require("../package.json").version,
  });
  for (const tool of addPagingSchemas(TOOL_DEFINITIONS)) {
    const properties = tool.inputSchema.properties;
    for (const value of Object.values(properties) as any[]) {
      if (value.type === "string") {
        value.minLength = 1;
        value.maxLength = 1024;
      }
    }
    for (const name of ["max_rows", "maxResults"]) {
      if (properties[name])
        Object.assign(properties[name], {
          type: "integer",
          minimum: 1,
          maximum: 10000,
        });
    }
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: fromJsonSchema<Record<string, unknown>>({
          ...tool.inputSchema,
          additionalProperties: false,
        }),
        annotations: {
          readOnlyHint: !ICF_WRITE_TOOLS.has(tool.name),
          destructiveHint: tool.name === "DeleteICFNode",
          idempotentHint: !ICF_WRITE_TOOLS.has(tool.name),
          openWorldHint: true,
        },
      },
      async (args, ctx) =>
        withRequestSignal(
          ctx.mcpReq.signal,
          async () => (await HANDLERS[tool.name](args)) as CallToolResult,
        ),
    );
  }
  return server;
}

export class mcp_abap_adt_server {
  async run() {
    const handle = serveStdio(() => createServer());
    const stop = async () => {
      await handle.close();
      cleanup();
    };
    process.once("SIGINT", () => {
      void stop();
    });
    process.once("SIGTERM", () => {
      void stop();
    });
    process.stdin.once("end", cleanup);
  }
}

if (require.main === module) {
  new mcp_abap_adt_server().run().catch(() => {
    console.error("Unable to start mcp-abap-adt");
    process.exitCode = 1;
  });
}
