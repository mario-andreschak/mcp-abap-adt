import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequestWithTimeout, getBaseUrl, encodeSapObjectName } from '../lib/utils';
import { objectsListCache } from '../lib/getObjectsListCache';
import { XMLParser } from 'fast-xml-parser';

/**
 * Search object type handler: determines the ABAP object type by exact name (no mask *).
 * Uses the ADT endpoint quickSearch, but does not add * to the query.
 * Returns a result only for an exact name, without fuzzy/mask search.
 * @param args { name: string, maxResults?: number }
 */
export async function handleSearchObject(args: any) {
    try {
        if (!args?.name) {
            throw new McpError(ErrorCode.InvalidParams, 'Object name is required');
        }
        const maxResults = args.maxResults || 100;
        const url = `${await getBaseUrl()}/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=${encodeSapObjectName(args.name)}&maxResults=${maxResults}`;
        const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
        const xml = response.data;
        const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
        const parsed = parser.parse(xml);

        // Витягуємо всі objectReference
        let refs = parsed?.['adtcore:objectReferences']?.['adtcore:objectReference'];
        if (!refs) {
            return {
                isError: true,
                content: [
                    {
                        type: 'text',
                        data: 'No result',
                        mimeType: 'text/plain'
                    }
                ]
            };
        }
        if (!Array.isArray(refs)) refs = [refs];

        const result = refs.map((ref: any) => ({
            objectType: ref['adtcore:type'] || '',
            objectName: ref['adtcore:name'] || '',
            packageName: ref['adtcore:packageName'] || '',
            description: ref['adtcore:description'] || '',
            shortText: ref['adtcore:shortText'] || '',
            longText: ref['adtcore:longText'] || '',
            text: ref['adtcore:text'] || '',
            uri: ref['adtcore:uri'] || ''
        }));

        objectsListCache.setCache(result);

        return {
            isError: false,
            content: [
                {
                    type: 'text',
                    data: JSON.stringify(result, null, 2),
                    mimeType: 'application/json'
                }
            ]
        };
    } catch (error) {
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    data: error instanceof Error ? error.message : String(error),
                    mimeType: 'text/plain'
                }
            ]
        };
    }
}
