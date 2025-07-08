import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';
import { writeResultToFile } from '../lib/writeResultToFile';

export async function handleGetProgram(args: any) {
    try {
        if (!args?.program_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Program name is required');
        }
        const url = `${await getBaseUrl()}/sap/bc/adt/programs/programs/${encodeSapObjectName(args.program_name)}/source/main`;

        const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
        const plainText = response.data;
        if (args.filePath) {
            writeResultToFile(plainText, args.filePath);
        }
        return {
            isError: false,
            content: [
                {
                    type: "text",
                    text: plainText
                }
            ]
        };
    }
    catch (error) {
        return return_error(error);
    }
}
