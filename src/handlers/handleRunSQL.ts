import { McpError, ErrorCode } from '../lib/utils';
import { createAxiosInstance, getAuthHeaders, return_error, getBaseUrl } from '../lib/utils';

export async function handleRunSQL(args: any) {
    try {
        if (!args?.sql_query) {
            throw new McpError(ErrorCode.InvalidParams, 'sql_query is required');
        }
        const maxRows = args.max_rows || 100;
        const baseUrl = await getBaseUrl();
        const url = `${baseUrl}/sap/bc/adt/datapreview/freestyle?rowNumber=${maxRows}&sap-client=100`;

        const response = await createAxiosInstance()({
            method: 'POST',
            url,
            headers: {
                ...(await getAuthHeaders()),
                'Content-Type': 'text/plain',
                'Accept': 'application/xml, text/plain, */*'
            },
            data: args.sql_query,
            timeout: 30000
        });

        return {
            isError: false,
            content: [{
                type: 'text',
                text: typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
            }]
        };
    } catch (error) {
        return return_error(error);
    }
}
