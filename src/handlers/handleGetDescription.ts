/**
 * DEBUG: GROUP RESOLVE LOGIC ACTIVE
 */
// GetDescription: Strict match ABAP object search by name, returns metadata and description.

import { McpError, ErrorCode, makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';
import { handleSearchObject } from './handleSearchObject';
import { XMLParser } from 'fast-xml-parser';

interface FunctionModuleMeta {
  group: string;
  name: string;
  package?: string;
  description?: string;
}

async function resolveFunctionGroupIfNeeded(objectType: string, objectName: string): Promise<string | FunctionModuleMeta> {
  if (objectType.toLowerCase() === "function" && !objectName.includes('|')) {
    const searchResult = await handleSearchObject({ query: objectName, maxResults: 999 });
    if (searchResult.isError || !Array.isArray(searchResult.content)) {
      throw new McpError(ErrorCode.InvalidParams, `SearchObject failed for "${objectName}"`);
    }
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
    let found: FunctionModuleMeta | undefined;
    for (const entry of searchResult.content) {
      if (typeof entry.text === "string") {
        const parsed = parser.parse(entry.text);
        const refs = parsed?.['adtcore:objectReferences']?.['adtcore:objectReference'];
        const objects = refs
          ? Array.isArray(refs)
            ? refs
            : [refs]
          : [];
        for (const obj of objects) {
          if (
            obj['adtcore:type'] &&
            obj['adtcore:type'].toUpperCase() === "FUGR/FF" &&
            obj['adtcore:name'] &&
            obj['adtcore:name'].toUpperCase() === objectName.toUpperCase() &&
            obj['adtcore:uri']
          ) {
            const uri = obj['adtcore:uri'];
            const parts = uri.split('/');
            const groupIdx = parts.findIndex((p: string) => p === 'groups');
            if (groupIdx !== -1 && parts[groupIdx + 1]) {
              found = {
                group: parts[groupIdx + 1],
                name: objectName,
                package: obj['adtcore:packageName'],
                description: obj['adtcore:description'],
              };
              break;
            }
          }
        }
      }
      if (found) break;
    }
    if (!found) {
      throw new McpError(ErrorCode.InvalidParams, `Function module "${objectName}" not found via SearchObject handler.`);
    }
    // Повертаємо мета-інфо, а не просто group|name
    return found;
  }
  return objectName;
}

function buildAdtUri(objectType: string, objectName: string): string {
  const encodedName = encodeSapObjectName(objectName);
  switch (objectType.toLowerCase()) {
    case "enhancementspot":
    case "enhancement_spot":
    case "enhancement-spot":
    case "enhs":
    case "enho":
      return `/sap/bc/adt/enhancements/enhsxsb/${encodedName}`;
    case "enhancementimpl":
    case "enhancement_impl":
    case "enhancement-impl":
    case "enhi":
      return `/sap/bc/adt/enhancements/enhoxhh/${encodedName}`;
    case "class":
      return `/sap/bc/adt/oo/classes/${encodedName}`;
    case "interface":
      return `/sap/bc/adt/oo/interfaces/${encodedName}`;
    case "program":
      return `/sap/bc/adt/programs/programs/${encodedName}`;
    case "include":
      return `/sap/bc/adt/programs/includes/${encodedName}`;
    case "function":
      let group: string | undefined, func: string;
      if (objectName.includes('|')) {
        [group, func] = objectName.split('|');
      } else {
        func = objectName;
      }
      const encodedGroup = encodeSapObjectName(group as string);
      const encodedFunc = encodeSapObjectName(func);
      return `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedFunc}/source/main`;
    case "functiongroup":
      return `/sap/bc/adt/functions/groups/${encodedName}`;
    case "package":
      return `/sap/bc/adt/packages/${encodedName}`;
    case "table":
    case "tabl":
      return `/sap/bc/adt/ddic/tables/${encodedName}`;
    case "tabletype":
    case "tabletypes":
      return `/sap/bc/adt/ddic/tabletypes/${encodedName}`;
    case "bdef":
      return `/sap/bc/adt/bo/behaviordefinitions/${encodedName}`;
    default:
      return `/sap/bc/adt/${objectType.toLowerCase()}s/${encodedName}`;
  }
}

export async function handleGetDescription(args: any) {
  try {
    if (!args?.object_name) {
      throw new McpError(ErrorCode.InvalidParams, 'Parameter "object_name" is required.');
    }
    const baseUrl = await getBaseUrl();
    let objectName = args.object_name;
    let fmMeta: FunctionModuleMeta | undefined = undefined;
    if (args.object_type.toLowerCase() === "function" && !objectName.includes('|')) {
      const resolved = await resolveFunctionGroupIfNeeded(args.object_type, objectName);
      if (typeof resolved === "string") {
        objectName = resolved;
      } else {
        objectName = `${resolved.group}|${resolved.name}`;
        fmMeta = resolved;
      }
    }
    const adtUri = buildAdtUri(args.object_type, objectName);
    const endpoint = `${baseUrl}/sap/bc/adt/repository/informationsystem/objectproperties/values?uri=${encodeURIComponent(adtUri)}&facet=package&facet=appl`;
    const response = await makeAdtRequestWithTimeout(endpoint, 'GET', 'default');
    const xml = response.data;
    let result: Record<string, any> = {};

    // Використовуємо fast-xml-parser для всіх типів
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
    const parsed = parser.parse(xml);

    if (args.object_type.toLowerCase() === "function") {
      // Шукаємо <opr:property facet="FUNCTIONMODULE" ...>
      let funcName, funcDesc, funcPackage;
      if (parsed?.opr && parsed.opr.property) {
        const props = Array.isArray(parsed.opr.property) ? parsed.opr.property : [parsed.opr.property];
        for (const prop of props) {
          if (prop.facet === "FUNCTIONMODULE") {
            funcName = prop.name;
            funcDesc = prop.text || prop.description || prop.shortText;
          }
          if (prop.facet === "PACKAGE") {
            funcPackage = prop.name;
          }
        }
      }
      if (funcName) {
        result = {
          name: funcName,
          type: "FUNCTIONMODULE",
          description: funcDesc,
          package: funcPackage,
        };
      } else if (fmMeta) {
        result = {
          name: fmMeta.name,
          group: fmMeta.group,
          type: "FUNCTIONMODULE",
          package: fmMeta.package,
          description: fmMeta.description,
        };
      } else {
        const [group, func] = objectName.split('|');
        result = {
          name: func,
          group,
          type: "FUNCTIONMODULE",
        };
      }
    } else if (
      args.object_type.toLowerCase() === "table" ||
      args.object_type.toLowerCase() === "tabletype" ||
      args.object_type.toLowerCase() === "tabletypes"
    ) {
      // Парсинг для table та tabletype: шукаємо в parsed['opr:objectProperties']['opr:object']
      const obj = parsed?.['opr:objectProperties']?.['opr:object'];
      if (obj) {
        result = {
          name: obj.name,
          type: obj.type,
          description: obj.text,
          package: obj.package,
        };
      }
    } else {
      // Для інших типів шукаємо <opr:object ...> і <opr:property ...>
      let obj = parsed?.opr?.object;
      if (obj) {
        result = {
          name: obj.name,
          type: obj.type,
          description: obj.text,
          package: obj.package,
        };
      }
      if (parsed?.opr?.property) {
        const props = Array.isArray(parsed.opr.property) ? parsed.opr.property : [parsed.opr.property];
        for (const prop of props) {
          if (prop.facet === "PACKAGE") {
            result.package = prop.name;
            result.package_text = prop.text;
          }
          if (prop.facet === "APPL") {
            result.application = prop.name;
            result.application_text = prop.text;
          }
        }
      }
    }

    // Fallback: якщо result порожній, повернути все що є в parsed.opr або parsed
    if (!result || Object.keys(result).length === 0) {
      if (parsed?.opr) {
        result = parsed.opr;
      } else {
        result = parsed;
      }
    }
    return {
      isError: false,
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return return_error(error);
  }
}
