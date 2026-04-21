import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

export async function handleGetServiceDefinition(args: any) {
    try {
        if (!args?.srvd_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Service Definition name is required');
        }
        const encodedName = encodeURIComponent(args.srvd_name.toUpperCase());
        const url = `${await getBaseUrl()}/sap/bc/adt/ddic/srvd/sources/${encodedName}/source/main`;
        const response = await makeAdtRequest(url, 'GET', 30000);
        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
