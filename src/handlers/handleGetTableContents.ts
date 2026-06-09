import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

export async function handleGetTableContents(args: any) {
    try {
        if (!args?.table_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Table name is required');
        }
        const system = args?.sap_system || 'S4H';
        const maxRows = args.max_rows || 100;
        const encodedTableName = encodeURIComponent(args.table_name);
        const url = `${await getBaseUrl(system)}/z_mcp_abap_adt/z_tablecontent/${encodedTableName}?maxRows=${maxRows}`;
        const response = await makeAdtRequest(url, 'GET', 30000, undefined, undefined, system);
        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
