import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

export async function handleGetTableContents(args: any) {
    try {
        if (!args?.table_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Table name is required');
        }
        const maxRows = args.max_rows || 100;
        //NOTE: This service requires a custom service implementation
        const url = `${await getBaseUrl()}/z_mcp_abap_adt/z_tablecontent/${args.table_name}?maxRows=${maxRows}`;
        const response = await makeAdtRequest(url, 'GET', 30000);
        return return_response(response);
    } catch (error) {
        // Specific error message for GetTableContents since it requires custom implementation
        return return_error(error);
    }
}
