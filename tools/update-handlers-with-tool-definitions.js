#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Мапа імен хендлерів до їх описів (взято з оригінального index.ts)
const TOOL_DEFINITIONS = {
  'handleGetFunctionGroup': {
    name: "GetFunctionGroup",
    description: "Retrieve ABAP Function Group source code.",
    inputSchema: {
      type: "object",
      properties: {
        function_group: { type: "string", description: "Name of the function group" }
      },
      required: ["function_group"]
    }
  },
  'handleGetTable': {
    name: "GetTable",
    description: "Retrieve ABAP table structure.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Name of the ABAP table" }
      },
      required: ["table_name"]
    }
  },
  'handleGetStructure': {
    name: "GetStructure",
    description: "Retrieve ABAP Structure.",
    inputSchema: {
      type: "object",
      properties: {
        structure_name: { type: "string", description: "Name of the ABAP Structure" }
      },
      required: ["structure_name"]
    }
  },
  'handleGetTableContents': {
    name: "GetTableContents",
    description: "Retrieve contents of an ABAP table.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Name of the ABAP table" },
        max_rows: { type: "number", description: "Maximum number of rows to retrieve", default: 100 }
      },
      required: ["table_name"]
    }
  },
  'handleGetPackage': {
    name: "GetPackage",
    description: "Retrieve ABAP package details.",
    inputSchema: {
      type: "object",
      properties: {
        package_name: { type: "string", description: "Name of the ABAP package" }
      },
      required: ["package_name"]
    }
  },
  'handleGetInclude': {
    name: "GetInclude",
    description: "Retrieve source code of a specific ABAP include file.",
    inputSchema: {
      type: "object",
      properties: {
        include_name: { type: "string", description: "Name of the ABAP Include" }
      },
      required: ["include_name"]
    }
  },
  'handleGetIncludesList': {
    name: "GetIncludesList",
    description: "Recursively discover and list ALL include files within an ABAP program or include.",
    inputSchema: {
      type: "object",
      properties: {
        object_name: { type: "string", description: "Name of the ABAP program or include" },
        object_type: { type: "string", enum: ["program", "include"], description: "Type of the ABAP object" },
        detailed: { type: "boolean", description: "If true, returns structured JSON with metadata and raw XML.", default: false },
        timeout: { type: "number", description: "Timeout in ms for each ADT request." }
      },
      required: ["object_name", "object_type"]
    }
  },
  'handleGetTypeInfo': {
    name: "GetTypeInfo",
    description: "Retrieve ABAP type information.",
    inputSchema: {
      type: "object",
      properties: {
        type_name: { type: "string", description: "Name of the ABAP type" }
      },
      required: ["type_name"]
    }
  },
  'handleGetInterface': {
    name: "GetInterface",
    description: "Retrieve ABAP interface source code.",
    inputSchema: {
      type: "object",
      properties: {
        interface_name: { type: "string", description: "Name of the ABAP interface" }
      },
      required: ["interface_name"]
    }
  },
  'handleGetTransaction': {
    name: "GetTransaction",
    description: "Retrieve ABAP transaction details.",
    inputSchema: {
      type: "object",
      properties: {
        transaction_name: { type: "string", description: "Name of the ABAP transaction" }
      },
      required: ["transaction_name"]
    }
  },
  'handleSearchObject': {
    name: "SearchObject",
    description: "Search for ABAP objects by name pattern.",
    inputSchema: {
      type: "object",
      properties: {
        search_pattern: { type: "string", description: "Search pattern for ABAP objects" },
        object_type: { type: "string", description: "Type of ABAP object to search for" }
      },
      required: ["search_pattern"]
    }
  },
  'handleGetEnhancements': {
    name: "GetEnhancements",
    description: "Retrieve a list of enhancements for a given ABAP object.",
    inputSchema: {
      type: "object",
      properties: {
        object_name: { type: "string", description: "Name of the ABAP object" },
        object_type: { type: "string", description: "Type of the ABAP object" }
      },
      required: ["object_name", "object_type"]
    }
  },
  'handleGetEnhancementImpl': {
    name: "GetEnhancementImpl",
    description: "Retrieve source code of a specific enhancement implementation by its name and enhancement spot.",
    inputSchema: {
      type: "object",
      properties: {
        enhancement_spot: { type: "string", description: "Name of the enhancement spot" },
        enhancement_name: { type: "string", description: "Name of the enhancement implementation" }
      },
      required: ["enhancement_spot", "enhancement_name"]
    }
  },
  'handleGetEnhancementSpot': {
    name: "GetEnhancementSpot",
    description: "Retrieve metadata and list of implementations for a specific enhancement spot.",
    inputSchema: {
      type: "object",
      properties: {
        enhancement_spot: { type: "string", description: "Name of the enhancement spot" }
      },
      required: ["enhancement_spot"]
    }
  },
  'handleGetBdef': {
    name: "GetBdef",
    description: "Retrieve the source code of a BDEF (Behavior Definition) for a CDS entity.",
    inputSchema: {
      type: "object",
      properties: {
        bdef_name: { type: "string", description: "Name of the BDEF (Behavior Definition)" }
      },
      required: ["bdef_name"]
    }
  },
  'handleGetSqlQuery': {
    name: "GetSqlQuery",
    description: "Execute freestyle SQL queries via SAP ADT Data Preview API.",
    inputSchema: {
      type: "object",
      properties: {
        sql_query: { type: "string", description: "SQL query to execute" },
        row_number: { type: "number", description: "Maximum number of rows to return", default: 100 }
      },
      required: ["sql_query"]
    }
  },
  'handleGetRelatedObjectTypes': {
    name: "GetRelatedObjectTypes",
    description: "Retrieves related ABAP object types for a given object.",
    inputSchema: {
      type: "object",
      properties: {
        object_name: { type: "string", description: "Name of the ABAP object" }
      },
      required: ["object_name"]
    }
  },
  'handleGetWhereUsed': {
    name: "GetWhereUsed",
    description: "Retrieve where-used references for ABAP objects via ADT usageReferences.",
    inputSchema: {
      type: "object",
      properties: {
        object_name: { type: "string", description: "Name of the ABAP object" },
        object_type: { type: "string", description: "Type of the ABAP object" },
        detailed: { type: "boolean", description: "If true, returns all references including packages and internal components.", default: false }
      },
      required: ["object_name", "object_type"]
    }
  }
};

function updateHandlerFile(filePath, handlerName) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Перевіряємо, чи вже є TOOL_DEFINITION
  if (content.includes('export const TOOL_DEFINITION')) {
    console.log(`Пропускаємо ${filePath} - TOOL_DEFINITION вже існує`);
    return false;
  }
  
  const definition = TOOL_DEFINITIONS[handlerName];
  if (!definition) {
    console.log(`Немає визначення для ${handlerName}`);
    return false;
  }
  
  // Знаходимо перший import
  const lines = content.split('\n');
  let insertIndex = 0;
  
  // Знаходимо останній import
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) {
      insertIndex = i + 1;
    } else if (lines[i].trim() === '' && insertIndex > 0) {
      insertIndex = i + 1;
      break;
    }
  }
  
  // Створюємо TOOL_DEFINITION
  const toolDefinition = `
export const TOOL_DEFINITION = ${JSON.stringify(definition, null, 2)} as const;
`;
  
  // Вставляємо після imports
  lines.splice(insertIndex, 0, toolDefinition);
  
  // Записуємо файл
  fs.writeFileSync(filePath, lines.join('\n'));
  console.log(`Оновлено ${filePath}`);
  return true;
}

function main() {
  const handlersDir = path.join(__dirname, '..', 'src', 'handlers');
  const files = fs.readdirSync(handlersDir);
  
  let updatedCount = 0;
  
  files.forEach(file => {
    if (!file.endsWith('.ts')) return;
    
    const handlerName = path.basename(file, '.ts');
    const filePath = path.join(handlersDir, file);
    
    if (updateHandlerFile(filePath, handlerName)) {
      updatedCount++;
    }
  });
  
  console.log(`Оновлено ${updatedCount} файлів`);
}

if (require.main === module) {
  main();
}

module.exports = { updateHandlerFile, TOOL_DEFINITIONS };
