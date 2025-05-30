import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

export async function handleGetTableContents(args: any) {
    try {
        if (!args?.table_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Table name is required');
        }
        const maxRows = args.max_rows || 100;
        // Use ADT data preview service to get table contents
        const url = `${await getBaseUrl()}/sap/bc/adt/datapreview/ddic?rowNumber=${maxRows}&ddicEntityName=${args.table_name}`;
        const response = await makeAdtRequest(url, 'GET', 30000);
        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
