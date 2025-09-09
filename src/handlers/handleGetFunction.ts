import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

export async function handleGetFunction(args: any) {
    try {
        if (!args?.function_name || !args?.function_group) {
            throw new McpError(ErrorCode.InvalidParams, 'Function name and group are required');
        }
        const encodedFunctionName = encodeURIComponent(args.function_name);
        const encodedFunctionGroup = encodeURIComponent(args.function_group);
        const url = `${await getBaseUrl()}/sap/bc/adt/functions/groups/${encodedFunctionGroup}/fmodules/${encodedFunctionName}/source/main`;
        const response = await makeAdtRequest(url, 'GET', 30000);
        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
