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
    let result = return_response(response);

    objectsListCache.setCache(result);
    return result;
  } catch (error) {
    return return_error(error);
  }
}
