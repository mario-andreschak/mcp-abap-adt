import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

export async function handleGetFunctionGroup(args: any) {
    try {
        if (!args?.function_group) {
            throw new McpError(ErrorCode.InvalidParams, 'Function Group is required');
        }
        const system = args?.sap_system || 'S4H';
        const encodedFunctionGroup = encodeURIComponent(args.function_group);
        const url = `${await getBaseUrl(system)}/sap/bc/adt/functions/groups/${encodedFunctionGroup}/source/main`;
        const response = await makeAdtRequest(url, 'GET', 30000, undefined, undefined, system);
        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
