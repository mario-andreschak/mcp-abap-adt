export const TOOL_DEFINITION = {
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
} as const;

import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';
import { objectsListCache } from '../lib/getObjectsListCache';

/**
 * Strict search handler: шукає об'єкт тільки по точному імені (без маски *).
 * Використовує ADT endpoint quickSearch, але не додає * до query.
 * Повертає результат тільки для точного імені, без fuzzy/mask-пошуку.
 * @param args { query: string, maxResults?: number }
 */
export async function handleGetDescription(args: any) {
    try {
        const { object_name, object_type } = args;
        if (!object_name || !object_type) {
            throw new McpError(ErrorCode.InvalidParams, 'object_name and object_type are required');
        }
        const query = object_name;
        // Максимальна кількість результатів (наприклад, 1000)
        const url = `${await getBaseUrl()}/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=${encodeSapObjectName(query)}&maxResults=1000`;
        const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
        let result = return_response(response);

        // Фільтрація по object_type
        if (Array.isArray(result?.content)) {
            result.content = result.content.filter(
                (obj: any) =>
                    obj.object_type === object_type ||
                    obj.type === object_type ||
                    obj.OBJECT_TYPE === object_type
            );
        }

        objectsListCache.setCache(result);
        return result;
    } catch (error) {
        return return_error(error);
    }
}
