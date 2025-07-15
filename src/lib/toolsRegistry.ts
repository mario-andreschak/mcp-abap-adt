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
import { TOOL_DEFINITION as GetWhereUsed_Tool } from '../handlers/handleGetWhereUsed';
import { TOOL_DEFINITION as GetObjectInfo_Tool } from '../handlers/handleGetObjectInfo';
import { TOOL_DEFINITION as DetectObjectTypeListArray_Tool } from '../handlers/handleDescribeByListArray';
import { TOOL_DEFINITION as DetectObjectTypeListJson_Tool } from '../handlers/handleDescribeByListJSON';
import { TOOL_DEFINITION as GetObjectsByType_Tool } from '../handlers/handleGetObjectsByType';
import { TOOL_DEFINITION as GetObjectsList_Tool } from '../handlers/handleGetObjectsList';
import { TOOL_DEFINITION as GetProgFullCode_Tool } from '../handlers/handleGetProgFullCode';
import { TOOL_DEFINITION as GetObjectNodeFromCache_Tool } from '../handlers/handleGetObjectNodeFromCache';
import { TOOL_DEFINITION as GetDescription_Tool } from '../handlers/handleGetDescription';

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
  GetObjectsByType_Tool,
  GetObjectsList_Tool,
  GetProgFullCode_Tool,
  GetObjectNodeFromCache_Tool,
  GetDescription_Tool,
  DetectObjectTypeListArray_Tool,
  DetectObjectTypeListJson_Tool
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
  GetWhereUsed_Tool,
  ...DYNAMIC_IMPORT_TOOLS,
  GetObjectInfo_Tool
];

// Функція для отримання всіх інструментів
export function getAllTools(): ToolDefinition[] {
  return ALL_TOOLS;
}

// Функція для пошуку інструмента за іменем
export function getToolByName(name: string): ToolDefinition | undefined {
  return ALL_TOOLS.find(tool => tool.name === name);
}
