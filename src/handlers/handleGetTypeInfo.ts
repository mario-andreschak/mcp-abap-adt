import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

export async function handleGetTypeInfo(args: any) {
    try {
        if (!args?.type_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Type name is required');
        }
    } catch (error) {
        return return_error(error);
    }

    const encodedTypeName = encodeURIComponent(args.type_name);


    try {

        const url = `${await getBaseUrl()}/sap/bc/adt/ddic/domains/${encodedTypeName}/source/main`;
        const response = await makeAdtRequest(url, 'GET', 30000);
        return return_response(response);
    } catch (error) {

        // no domain found, try data element
        try {
            const url = `${await getBaseUrl()}/sap/bc/adt/ddic/dataelements/${encodedTypeName}`;
            const response = await makeAdtRequest(url, 'GET', 30000);
            return return_response(response);
        } catch (error) {
            return return_error(error);
        }

    }
}
