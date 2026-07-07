import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { AxiosError } from 'axios';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

export async function handleGetBehaviorDefinition(args: any) {
    try {
        if (!args?.behavior_definition_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Behavior definition name is required');
        }
        const encodedName = encodeURIComponent(String(args.behavior_definition_name).toUpperCase());
        const url = `${await getBaseUrl()}/sap/bc/adt/bo/behaviordefinitions/${encodedName}/source/main`;
        try {
            const response = await makeAdtRequest(url, 'GET', 30000);
            return return_response(response);
        } catch (error) {
            // The RAP stack (BDEF) does not exist before ~NW 7.54 / S/4HANA, so the
            // behaviordefinitions collection is not registered in the ADT discovery
            // document on older systems and the request 404s. Surface a clear message
            // rather than the raw ADT 404 XML.
            if (error instanceof AxiosError && error.response?.status === 404) {
                throw new McpError(
                    ErrorCode.InvalidRequest,
                    `Behavior Definition '${args.behavior_definition_name}' not found, or the RAP behavior-definition endpoint is not available on this system (requires ~NW 7.54 / S/4HANA with the RAP stack).`
                );
            }
            throw error;
        }
    } catch (error) {
        return return_error(error);
    }
}
