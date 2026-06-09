import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

export async function handleGetTypeInfo(args: any) {
    try {
        if (!args?.type_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Type name is required');
        }
    } catch (error) {
        return return_error(error);
    }

    const system = args?.sap_system || 'S4H';
    const encodedTypeName = encodeURIComponent(args.type_name);

    try {
        const url = `${await getBaseUrl(system)}/sap/bc/adt/ddic/domains/${encodedTypeName}/source/main`;
        const response = await makeAdtRequest(url, 'GET', 30000, undefined, undefined, system);
        return return_response(response);
    } catch (error) {
        // no domain found, try data element
        try {
            const url = `${await getBaseUrl(system)}/sap/bc/adt/ddic/dataelements/${encodedTypeName}`;
            const response = await makeAdtRequest(url, 'GET', 30000, undefined, undefined, system);
            return return_response(response);
        } catch (error) {
            return return_error(error);
        }
    }
}
