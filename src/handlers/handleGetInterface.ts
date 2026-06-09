import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

export async function handleGetInterface(args: any) {
    try {
        if (!args?.interface_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Interface name is required');
        }
        const system = args?.sap_system || 'S4H';
        const encodedInterfaceName = encodeURIComponent(args.interface_name);
        const url = `${await getBaseUrl(system)}/sap/bc/adt/oo/interfaces/${encodedInterfaceName}/source/main`;
        const response = await makeAdtRequest(url, 'GET', 30000, undefined, undefined, system);
        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
