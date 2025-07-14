import { TOOL_DEFINITION as GetProgram_Tool } from '../handlers/handleGetProgram';
import { TOOL_DEFINITION as GetClass_Tool } from '../handlers/handleGetClass';
import { TOOL_DEFINITION as GetFunction_Tool } from '../handlers/handleGetFunction';
import { TOOL_DEFINITION as GetFunctionGroup_Tool } from '../handlers/handleGetFunctionGroup';
import { TOOL_DEFINITION as GetTable_Tool } from '../handlers/handleGetTable';
import { TOOL_DEFINITION as GetStructure_Tool } from '../handlers/handleGetStructure';
import { TOOL_DEFINITION as GetTableContents_Tool } from '../handlers/handleGetTableContents';
import { TOOL_DEFINITION as GetPackage_Tool } from '../handlers/handleGetPackage';
import { TOOL_DEFINITION as GetInclude_Tool } from '../handlers/handleGetInclude';
import { TOOL_DEFINITION as GetIncludesList_Tool } from '../handlers/handleGetIncludesList';
import { TOOL_DEFINITION as GetTypeInfo_Tool } from '../handlers/handleGetTypeInfo';
import { TOOL_DEFINITION as GetInterface_Tool } from '../handlers/handleGetInterface';
import { TOOL_DEFINITION as GetTransaction_Tool } from '../handlers/handleGetTransaction';
import { TOOL_DEFINITION as SearchObject_Tool } from '../handlers/handleSearchObject';
import { TOOL_DEFINITION as GetEnhancements_Tool } from '../handlers/handleGetEnhancements';
import { TOOL_DEFINITION as GetEnhancementImpl_Tool } from '../handlers/handleGetEnhancementImpl';
import { TOOL_DEFINITION as GetEnhancementSpot_Tool } from '../handlers/handleGetEnhancementSpot';
import { TOOL_DEFINITION as GetBdef_Tool } from '../handlers/handleGetBdef';
import { TOOL_DEFINITION as GetSqlQuery_Tool } from '../handlers/handleGetSqlQuery';
import { TOOL_DEFINITION as GetRelatedObjectTypes_Tool } from '../handlers/handleGetRelatedObjectTypes';
import { TOOL_DEFINITION as GetWhereUsed_Tool } from '../handlers/handleGetWhereUsed';

// Тип для опису інструмента
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: readonly string[];
  };
}

// Статичні описи для інструментів з динамічним імпортом
const DYNAMIC_IMPORT_TOOLS: ToolDefinition[] = [
  {
    name: "GetObjectsByType",
    description: "Retrieves all ABAP objects of a specific type under a given node.",
    inputSchema: {
      type: "object",
      properties: {
        parent_name: { type: "string" },
        parent_tech_name: { type: "string" },
        parent_type: { type: "string" },
        node_id: { type: "string" },
        format: { type: "string", description: "Output format: 'raw' or 'parsed'" },
        with_short_descriptions: { type: "boolean" }
      },
      required: ["parent_name", "parent_tech_name", "parent_type", "node_id"]
    }
  },
  {
    name: "GetObjectsList",
    description: "Recursively retrieves all valid ABAP repository objects for a given parent (program, function group, etc.) including nested includes.",
    inputSchema: {
      type: "object",
      properties: {
        parent_name: { type: "string", description: "Parent object name" },
        parent_tech_name: { type: "string", description: "Parent technical name" },
        parent_type: { type: "string", description: "Parent object type (e.g. PROG/P, FUGR)" },
        with_short_descriptions: { type: "boolean", description: "Include short descriptions (default: true)" }
      },
      required: ["parent_name", "parent_tech_name", "parent_type"]
    }
  },
  {
    name: "GetProgFullCode",
    description: "Returns the full code for a program or function group, including all includes, in tree traversal order.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Technical name of the program or function group" },
        type: { type: "string", enum: ["PROG/P", "FUGR"], description: "Object type: 'PROG/P' for program, 'FUGR' for function group" }
      },
      required: ["name", "type"]
    }
  },
  {
    name: "GetObjectNodeFromCache",
    description: "Returns a node from the in-memory objects list cache by OBJECT_TYPE, OBJECT_NAME, TECH_NAME, and expands OBJECT_URI if present.",
    inputSchema: {
      type: "object",
      properties: {
        object_type: { type: "string" },
        object_name: { type: "string" },
        tech_name: { type: "string" }
      },
      required: ["object_type", "object_name", "tech_name"]
    }
  },
  {
    name: "GetDescription",
    description: "Strict match ABAP object search by name. Returns metadata and description for an object with the exact name and type.",
    inputSchema: {
      type: "object",
      properties: {
        object_name: { type: "string", description: "Exact name of the ABAP object to search for" },
        object_type: { type: "string", description: "ABAP object type" }
      },
      required: ["object_name", "object_type"]
    }
  },
  {
    name: "DetectObjectType",
    description: "Detects the ABAP object type by exact object name (no mask, no fuzzy). Returns the same structure as SearchObject, but only for exact matches. Use to determine the type of an object by its name.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Exact object name to detect type for" },
        maxResults: { type: "number", description: "Maximum number of results to return", default: 1 }
      },
      required: ["name"]
    }
  },
  {
    name: "DetectObjectTypeListArray",
    description: "Batch detection of ABAP object types. Input: direct array of objects [{ name: string, type?: string }]. Each object must have at least the 'name' property.",
    inputSchema: {
      type: "object",
      properties: {
        objects: {
          type: "array",
          description: "Array of objects with name and optional type. Each item: { name: string, type?: string }",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Object name (required)" },
              type: { type: "string", description: "Optional type" }
            },
            required: ["name"]
          }
        }
      },
      required: ["objects"]
    }
  },
  {
    name: "DetectObjectTypeListJson",
    description: "Batch detection of ABAP object types. Input: object with 'objects' property: { objects: [{ name: string, type?: string }] }. Each item in 'objects' must have at least the 'name' property.",
    inputSchema: {
      type: "object",
      properties: {
        objects: {
          type: "array",
          description: "Array of objects with name and optional type. Each item: { name: string, type?: string }",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Object name (required)" },
              type: { type: "string", description: "Optional type" }
            },
            required: ["name"]
          }
        }
      },
      required: ["objects"]
    }
  }
];

// Збираємо всі описи інструментів в одному масиві
export const ALL_TOOLS: ToolDefinition[] = [
  GetProgram_Tool,
  GetClass_Tool,
  GetFunction_Tool,
  GetFunctionGroup_Tool,
  GetTable_Tool,
  GetStructure_Tool,
  GetTableContents_Tool,
  GetPackage_Tool,
  GetInclude_Tool,
  GetIncludesList_Tool,
  GetTypeInfo_Tool,
  GetInterface_Tool,
  GetTransaction_Tool,
  SearchObject_Tool,
  GetEnhancements_Tool,
  GetEnhancementImpl_Tool,
  GetEnhancementSpot_Tool,
  GetBdef_Tool,
  GetSqlQuery_Tool,
  GetRelatedObjectTypes_Tool,
  GetWhereUsed_Tool,
  ...DYNAMIC_IMPORT_TOOLS
];

// Функція для отримання всіх інструментів
export function getAllTools(): ToolDefinition[] {
  return ALL_TOOLS;
}

// Функція для пошуку інструмента за іменем
export function getToolByName(name: string): ToolDefinition | undefined {
  return ALL_TOOLS.find(tool => tool.name === name);
}
