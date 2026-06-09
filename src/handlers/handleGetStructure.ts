import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

export async function handleGetStructure(args: any) {
    try {
        if (!args?.structure_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Structure name is required');
        }
        const system = args?.sap_system || 'S4H';
        const encodedStructureName = encodeURIComponent(args.structure_name);
        const url = `${await getBaseUrl(system)}/sap/bc/adt/ddic/structures/${encodedStructureName}/source/main`;
        const response = await makeAdtRequest(url, 'GET', 30000, undefined, undefined, system);
        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
