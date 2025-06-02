import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';

export async function handleGetStructure(args: any) {
    try {
        if (!args?.structure_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Structure name is required');
        }
        const url = `${await getBaseUrl()}/sap/bc/adt/ddic/structures/${encodeSapObjectName(args.structure_name)}/source/main`;
        const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
