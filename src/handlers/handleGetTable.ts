import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

export async function handleGetTable(args: any) {
    try {
        if (!args?.table_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Table name is required');
        }
        const encodedTableName = encodeURIComponent(args.table_name);
        const url = `${await getBaseUrl()}/sap/bc/adt/ddic/tables/${encodedTableName}/source/main`;
        const response = await makeAdtRequest(url, 'GET', 30000);
        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
