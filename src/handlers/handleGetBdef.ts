import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, getBaseUrl, logger, encodeSapObjectName } from '../lib/utils';


export const TOOL_DEFINITION = {
  "name": "GetBdef",
  "description": "Retrieve the source code of a BDEF (Behavior Definition) for a CDS entity.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "bdef_name": {
        "type": "string",
        "description": "Name of the BDEF (Behavior Definition)"
      }
    },
    "required": [
      "bdef_name"
    ]
  }
} as const;

/**
 * Interface for BDEF (Behavior Definition) response
 */
export interface BdefResponse {
    bdef_name: string;
    source_code?: string;
    functions?: Array<{ name: string; description?: string }>;
}

/**
 * Handler to retrieve the source code of a BDEF (Behavior Definition) for a CDS entity.
 * Uses the SAP ADT API endpoint for behavior definitions.
 * 
 * @param args - Tool arguments containing:
 *   - bdef_name: Name of the BDEF (Behavior Definition) (e.g., 'Z_I_MYENTITY')
 * @returns Response object containing:
 *   - bdef_name: The name of the BDEF
 *   - source_code: The source code of the BDEF (if found)
 *   - raw_xml: The raw XML response from the ADT API for debugging purposes
 *   - In case of error, an error object with details about the failure
 */
export async function handleGetBdef(args: any) {
    try {
        logger.info('handleGetBdef called with args:', args);

        if (!args?.bdef_name) {
            throw new McpError(ErrorCode.InvalidParams, 'BDEF name is required');
        }

        const bdefName = args.bdef_name;
        const bdefUri = args.bdef_uri; // Optional: full ADT URI

        logger.info(`Getting BDEF source for: ${bdefName}${bdefUri ? ` (uri: ${bdefUri})` : ''}`);

        const baseUrl = await getBaseUrl();
        // Always use the simple, direct endpoint as in the Python code
        const endpoint = `${baseUrl}/sap/bc/adt/bo/behaviordefinitions/${encodeSapObjectName(bdefName)}/source/main`;
        logger.info(`Requesting BDEF source from: ${endpoint}`);
        const response = await makeAdtRequestWithTimeout(endpoint, 'GET', 'default', {
            'Accept': 'text/plain'
        });

        if (response.status === 200 && typeof response.data === "string") {
            const result = {
                isError: false,
                content: [
                    {
                        type: "json",
                        json: {
                            bdef_name: bdefName,
                            source_code: response.data
                        }
                    }
                ]
            };
            if (args.filePath) {
                const fs = require('fs');
                fs.writeFileSync(args.filePath, JSON.stringify(result, null, 2), 'utf-8');
            }
            return result;
        } else if (response.status === 404) {
            throw new McpError(ErrorCode.InternalError, `Behavior definition '${bdefName}' not found`);
        } else {
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to retrieve BDEF ${bdefName}. Status: ${response.status}`
            );
        }
    } catch (error) {
        // MCP-compliant error response: always return content[] with type "text"
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: `ADT error: ${String(error)}`
                }
            ]
        };
    }
}
