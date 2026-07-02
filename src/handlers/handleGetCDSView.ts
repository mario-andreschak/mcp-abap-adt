import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

export async function handleGetCDSView(args: any) {
    try {
        if (!args?.cds_view_name) {
            throw new McpError(ErrorCode.InvalidParams, 'CDS view name is required');
        }
        const encodedCdsViewName = encodeURIComponent(String(args.cds_view_name).toUpperCase());
        const url = `${await getBaseUrl()}/sap/bc/adt/ddic/ddl/sources/${encodedCdsViewName}/source/main`;
        const response = await makeAdtRequest(url, 'GET', 30000);
        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
