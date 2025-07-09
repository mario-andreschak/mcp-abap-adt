// handleGetObjectNodeFromCache: повертає вузол з кешу за OBJECT_TYPE, OBJECT_NAME, TECH_NAME, розгортає OBJECT_URI

import { findNodeInCache, updateNodeInCache } from '../lib/getObjectsListCache';
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
    const node = findNodeInCache(object_type, object_name, tech_name);
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
            updateNodeInCache(object_type, object_name, tech_name, { object_uri_response: node.object_uri_response });
        } catch (e) {
            node.object_uri_response = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
        }
    }
    return {
        content: [{ type: 'json', json: node }]
    };
}
