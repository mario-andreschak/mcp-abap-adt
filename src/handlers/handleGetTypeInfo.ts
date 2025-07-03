import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';

export async function handleGetTypeInfo(args: any) {
    try {
        if (!args?.type_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Type name is required');
        }
    } catch (error) {
        return return_error(error);
    }


    try {

        const url = `${await getBaseUrl()}/sap/bc/adt/ddic/domains/${encodeSapObjectName(args.type_name)}/source/main`;
        const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
        return return_response(response);
    } catch (error) {

        // no domain found, try data element
        try {
            const url = `${await getBaseUrl()}/sap/bc/adt/ddic/dataelements/${encodeSapObjectName(args.type_name)}`;
            const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
            return return_response(response);
        } catch (error) {
            // no data element found, try table type
            try {
                const url = `${await getBaseUrl()}/sap/bc/adt/ddic/tabletypes/${encodeSapObjectName(args.type_name)}`;
                const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
                return return_response(response);
            } catch (error) {
                return return_error(error);
            }
        }

    }
}
