export const TOOL_DEFINITION = {
  name: "GetObjectNodeFromCache",
  description: "Returns a node from the in-memory objects list cache by OBJECT_TYPE, OBJECT_NAME, TECH_NAME, and expands OBJECT_URI if present.",
  inputSchema: {
    type: "object",
    properties: {
      object_type: { type: "string", description: "Object type" },
      object_name: { type: "string", description: "Object name" },
      tech_name: { type: "string", description: "Technical name" }
    },
    required: ["object_type", "object_name", "tech_name"]
  }
} as const;

// handleGetObjectNodeFromCache: повертає вузол з кешу за OBJECT_TYPE, OBJECT_NAME, TECH_NAME, розгортає OBJECT_URI

import { objectsListCache } from '../lib/getObjectsListCache';
import { makeAdtRequest, getBaseUrl } from '../lib/utils';

/**
 * @param args { object_type, object_name, tech_name }
 * @returns вузол з кешу з полем object_uri_response (якщо OBJECT_URI є)
 */
export async function handleGetObjectNodeFromCache(args: any) {
    const { object_type, object_name, tech_name } = args;
    if (!object_type || !object_name || !tech_name) {
        return {
            isError: true,
            content: [{ type: 'text', text: 'object_type, object_name, tech_name required' }]
        };
    }
    const cache = objectsListCache.getCache();
    let node: any = null;
    if (cache && Array.isArray(cache.objects)) {
        node = (cache.objects as any[]).find(
            (obj: any) =>
                obj.OBJECT_TYPE === object_type &&
                obj.OBJECT_NAME === object_name &&
                obj.TECH_NAME === tech_name
        ) || null;
    }
    if (!node) {
        return {
            isError: true,
            content: [{ type: 'text', text: 'Node not found in cache' }]
        };
    }
    if (node.OBJECT_URI && !node.object_uri_response) {
        try {
            const baseUrl = await getBaseUrl();
            const url = node.OBJECT_URI.startsWith('http')
                ? node.OBJECT_URI
                : baseUrl.replace(/\/$/, '') + node.OBJECT_URI;
            const resp = await makeAdtRequest(url, 'GET', 15000);
            node.object_uri_response = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);

            // Оновлюємо вузол у кеші
            const idx = cache.objects.findIndex(
                (obj: any) =>
                    obj.OBJECT_TYPE === object_type &&
                    obj.OBJECT_NAME === object_name &&
                    obj.TECH_NAME === tech_name
            );
            if (idx >= 0) {
                cache.objects[idx] = { ...cache.objects[idx], object_uri_response: node.object_uri_response };
                objectsListCache.setCache(cache);
            }
        } catch (e) {
            node.object_uri_response = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
        }
    }
    return {
        content: [{ type: 'json', json: node }]
    };
}
