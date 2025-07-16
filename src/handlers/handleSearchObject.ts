import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';
import { objectsListCache } from '../lib/getObjectsListCache';

export const TOOL_DEFINITION = {
  name: "SearchObject",
  description: "Search for ABAP objects by name pattern. Parameters: object_name (with or without mask), object_type (optional), maxResults (optional). If object_type is specified, results are filtered by type.",
  inputSchema: {
    type: "object",
    properties: {
      object_name: { type: "string", description: "Object name or mask (e.g. 'MARA*')" },
      object_type: { type: "string", description: "Optional ABAP object type (e.g. 'TABL', 'CLAS/OC')" },
      maxResults: { type: "number", description: "Maximum number of results to return", default: 100 }
    },
    required: ["object_name"]
  }
} as const;

// --- New function for ADT error handling ---
function detectAdtSearchError(response: any): { isError: boolean, content: any[] } | null {
  if (!response) return null;
  const status = response.status || response?.response?.status;
  if (status !== 200) {
    let msg = `ADT request failed (status ${status})`;
    if (status === 406) msg = "Invalid object_type (406 Not Acceptable)";
    if (status === 400) msg = "Bad request (400)";
    return {
      isError: true,
      content: [{ type: "text", text: msg }]
    };
  }
  return null;
}

export async function handleSearchObject(args: any) {
  try {
    const { object_name, object_type, maxResults } = args;
    if (!object_name) {
      throw new McpError(ErrorCode.InvalidParams, 'object_name is required');
    }
    const query = object_name;
    let url = `${await getBaseUrl()}/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=${encodeSapObjectName(query)}&maxResults=${maxResults || 100}`;
    // Додаємо object_type як маску, якщо задано
    if (object_type) {
      url += `&objectType=${encodeSapObjectName(object_type)}`;
    }
    const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');

    // --- Error handling using new function ---
    const adtError = detectAdtSearchError(response);
    if (adtError) return adtError;

let result = return_response(response);
const { isError, ...rest } = result;

  // Перевірка на порожню XML (<adtcore:objectReferences/>)
  const xmlText = rest.content?.[0]?.text || "";
  if (!xmlText.includes("<adtcore:objectReference ")) {
    // Якщо ADT не знайшов об'єкт, повертаємо порожній результат (це не помилка)
    return {
      isError: false,
      content: []
    };
  }

  // Парсинг усіх <adtcore:objectReference .../> з xmlText
  const matches = Array.from(xmlText.matchAll(/<adtcore:objectReference\s+([^>]*)\/>/g));
  if (!matches || matches.length === 0) {
    // Якщо ADT не знайшов об'єкт, повертаємо порожній результат (це не помилка)
    return {
      isError: false,
      content: []
    };
  }

  const resultsArr: Array<{ name: string; type: string; description: string; packageName: string }> = [];
  for (const m of matches as Array<RegExpMatchArray>) {
    const attrs = m[1];
    function extract(attr: string, def = ""): string {
      const mm = attrs.match(new RegExp(attr + '="([^"]*)"'));
      return mm ? mm[1] : def;
    }
    const name = extract("adtcore:name");
    const type = extract("adtcore:type");
    const description = extract("adtcore:description");
    let pkgName = extract("adtcore:packageName");
    // Якщо packageName порожній, пробуємо витягти з rawXML тег <adtcore:packageName>
    if (!pkgName) {
      const pkgMatch = xmlText.match(/<adtcore:packageName>([^<]*)<\/adtcore:packageName>/);
      if (pkgMatch) {
        pkgName = pkgMatch[1];
      }
    }
    resultsArr.push({ name, type, description, packageName: pkgName });
  }

  objectsListCache.setCache(result);
  return {
    isError: false,
    content: [
      {
        type: "text",
        text: JSON.stringify({ results: resultsArr, rawXML: xmlText })
      }
    ]
  };
  } catch (error) {
    // MCP-compliant error response: always return content[] with type "text"
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `ADT error: ${String(error)}`
        }
      ]
    };
  }
}
