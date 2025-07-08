import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';

export async function handleSearchObject(args: any) {
    try {
        if (!args?.query) {
            throw new McpError(ErrorCode.InvalidParams, 'Search query is required');
        }
        const maxResults = args.maxResults || 100;
        const url = `${await getBaseUrl()}/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=${encodeSapObjectName(args.query)}*&maxResults=${maxResults}`;
        const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
        const result = return_response(response);
        if (args.filePath) {
            const fs = require('fs');
            fs.writeFileSync(args.filePath, JSON.stringify(result, null, 2), 'utf-8');
        }
        return result;
    } catch (error) {
        return return_error(error);
    }
}
