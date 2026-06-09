import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

export async function handleGetClass(args: any) {
    try {
        if (!args?.class_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Class name is required');
        }
        const system = args?.sap_system || 'S4H';
        const encodedClassName = encodeURIComponent(args.class_name);
        const url = `${await getBaseUrl(system)}/sap/bc/adt/oo/classes/${encodedClassName}/source/main`;
        const response = await makeAdtRequest(url, 'GET', 30000, undefined, undefined, system);
        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
