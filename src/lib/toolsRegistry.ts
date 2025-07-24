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
import { TOOL_DEFINITION as DescribeByList_Tool } from '../handlers/handleDescribeByList';
import { TOOL_DEFINITION as GetObjectsByType_Tool } from '../handlers/handleGetObjectsByType';
import { TOOL_DEFINITION as GetObjectsList_Tool } from '../handlers/handleGetObjectsList';
import { TOOL_DEFINITION as GetProgFullCode_Tool } from '../handlers/handleGetProgFullCode';
import { TOOL_DEFINITION as GetObjectNodeFromCache_Tool } from '../handlers/handleGetObjectNodeFromCache';
import { TOOL_DEFINITION as GetAdtTypes_Tool } from '../handlers/handleGetAllTypes';
import { TOOL_DEFINITION as GetObjectStructure_Tool } from '../handlers/handleGetObjectStructure';
import { TOOL_DEFINITION as GetAbapAST_Tool } from '../handlers/handleGetAbapAST';
import { TOOL_DEFINITION as GetAbapSemanticAnalysis_Tool } from '../handlers/handleGetAbapSemanticAnalysis';
import { TOOL_DEFINITION as GetAbapSystemSymbols_Tool } from '../handlers/handleGetAbapSystemSymbols';

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
  DescribeByList_Tool
];

// Збираємо всі описи інструментів в одному масиві
export const ALL_TOOLS: ToolDefinition[] = [
  // Програми, класи, функції
  GetClass_Tool,
  GetFunction_Tool,
  GetFunctionGroup_Tool,
  GetProgram_Tool,

  // Таблиці, структури
  GetStructure_Tool,
  GetTable_Tool,
  GetTableContents_Tool,

  // Пакети, інтерфейси
  GetInterface_Tool,
  GetPackage_Tool,

  // Інклуди, ієрархії
  GetInclude_Tool,
  GetIncludesList_Tool,
  GetObjectStructure_Tool,

  // Типи, опис, інформація
  GetAdtTypes_Tool,
  GetTypeInfo_Tool,
  GetObjectInfo_Tool,

  // Пошук, SQL, транзакції
  GetSqlQuery_Tool,
  GetTransaction_Tool,
  SearchObject_Tool,
  GetWhereUsed_Tool,

  // Enhancement
  GetBdef_Tool,
  GetEnhancementImpl_Tool,
  GetEnhancements_Tool,
  GetEnhancementSpot_Tool,

  // ABAP Parser & Semantic Analysis
  GetAbapAST_Tool,
  GetAbapSemanticAnalysis_Tool,
  GetAbapSystemSymbols_Tool,

  // Динамічні інструменти
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
