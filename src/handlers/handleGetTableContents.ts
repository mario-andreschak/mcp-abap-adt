import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

export async function handleGetTableContents(args: any) {
    try {
        if (!args?.table_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Table name is required');
        }
        const tableName = String(args.table_name).toUpperCase();
        // Guard against anything but a plain table/view name (namespaces like /NS/TAB are allowed)
        if (!/^[A-Z0-9_/]+$/.test(tableName)) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid table name: ${args.table_name}`);
        }
        const maxRows = args.max_rows || 100;
        const url = `${await getBaseUrl()}/sap/bc/adt/datapreview/freestyle`;
        const response = await makeAdtRequest(
            url,
            'POST',
            30000,
            `SELECT * FROM ${tableName}`,
            { rowNumber: maxRows },
            { 'Content-Type': 'text/plain', 'Accept': 'application/xml, text/plain, */*' }
        );
        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
