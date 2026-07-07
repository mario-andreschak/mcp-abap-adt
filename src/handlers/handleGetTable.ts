import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { AxiosError } from 'axios';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

export async function handleGetTable(args: any) {
    try {
        if (!args?.table_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Table name is required');
        }
        const encodedTableName = encodeURIComponent(args.table_name);
        const baseUrl = await getBaseUrl();
        const tablesUrl = `${baseUrl}/sap/bc/adt/ddic/tables/${encodedTableName}/source/main`;
        try {
            const response = await makeAdtRequest(tablesUrl, 'GET', 30000);
            return return_response(response);
        } catch (error) {
            // The /sap/bc/adt/ddic/tables collection was introduced after NW 7.50 and is
            // not registered in the ADT discovery document on older systems. When it is
            // missing the request 404s. The /sap/bc/adt/ddic/structures endpoint exists on
            // 7.50 and serves transparent tables as well, so fall back to it.
            if (error instanceof AxiosError && error.response?.status === 404) {
                const structuresUrl = `${baseUrl}/sap/bc/adt/ddic/structures/${encodedTableName}/source/main`;
                const response = await makeAdtRequest(structuresUrl, 'GET', 30000);
                return return_response(response);
            }
            throw error;
        }
    } catch (error) {
        return return_error(error);
    }
}
