import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';
import { objectsListCache } from '../lib/getObjectsListCache';

export async function handleSearchObject(args: any) {
    try {
        if (!args?.query) {
            throw new McpError(ErrorCode.InvalidParams, 'Search query is required');
        }
        const maxResults = args.maxResults || 100;
        const url = `${await getBaseUrl()}/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=${encodeSapObjectName(args.query)}*&maxResults=${maxResults}`;
        const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
        const result = return_response(response);
        objectsListCache.setCache(result);
        return result;
    } catch (error) {
        return return_error(error);
    }
}
