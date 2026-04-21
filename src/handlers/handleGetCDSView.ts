import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

export async function handleGetCDSView(args: any) {
    try {
        if (!args?.view_name) {
            throw new McpError(ErrorCode.InvalidParams, 'CDS View name is required');
        }
        const encodedName = encodeURIComponent(args.view_name.toUpperCase());
        const url = `${await getBaseUrl()}/sap/bc/adt/ddic/ddl/sources/${encodedName}/source/main`;
        const response = await makeAdtRequest(url, 'GET', 30000);
        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
