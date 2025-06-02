import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';

export async function handleGetFunction(args: any) {
    try {
        if (!args?.function_name || !args?.function_group) {
            throw new McpError(ErrorCode.InvalidParams, 'Function name and group are required');
        }
        const url = `${await getBaseUrl()}/sap/bc/adt/functions/groups/${encodeSapObjectName(args.function_group)}/fmodules/${encodeSapObjectName(args.function_name)}/source/main`;
        const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
