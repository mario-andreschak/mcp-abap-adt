import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

export async function handleGetProgram(args: any) {
    try {
        if (!args?.program_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Program name is required');
        }
        const url = `${await getBaseUrl()}/sap/bc/adt/programs/programs/${args.program_name}/source/main`;

        const response = await makeAdtRequest(url, 'GET', 30000);
        return return_response(response);
    }
    catch (error) {
        return return_error(error);
    }
}
