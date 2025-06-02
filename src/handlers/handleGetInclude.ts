import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';

export async function handleGetInclude(args: any) {
    try {
        if (!args?.include_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Include name is required');
        }
        const url = `${await getBaseUrl()}/sap/bc/adt/programs/includes/${encodeSapObjectName(args.include_name)}/source/main`;
        const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
