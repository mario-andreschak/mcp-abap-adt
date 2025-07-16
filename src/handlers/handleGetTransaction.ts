import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';
import { XMLParser } from 'fast-xml-parser';
import { writeResultToFile } from '../lib/writeResultToFile';


export const TOOL_DEFINITION = {
  "name": "GetTransaction",
  "description": "Retrieve ABAP transaction details.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "transaction_name": {
        "type": "string",
        "description": "Name of the ABAP transaction"
      }
    },
    "required": [
      "transaction_name"
    ]
  }
} as const;

function parseTransactionXml(xml: string) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        parseAttributeValue: true,
        trimValues: true
    });
    const result = parser.parse(xml);

    // ADT Transaction XML (opr:objectProperties)
    if (result['opr:objectProperties'] && result['opr:objectProperties']['opr:object']) {
        const obj = result['opr:objectProperties']['opr:object'];
        return {
            name: obj['name'],
            objectType: 'transaction',
            description: obj['text'],
            package: obj['package'],
            type: obj['type']
        };
    }

    // fallback: return raw
    return { raw: result };
}

export async function handleGetTransaction(args: any) {
    try {
        if (!args?.transaction_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Transaction name is required');
        }
        const encodedTransactionName = encodeSapObjectName(args.transaction_name);
        const url = `${await getBaseUrl()}/sap/bc/adt/repository/informationsystem/objectproperties/values?uri=%2Fsap%2Fbc%2Fadt%2Fvit%2Fwb%2Fobject_type%2Ftrant%2Fobject_name%2F${encodedTransactionName}&facet=package&facet=appl`;
        const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
        // Якщо XML — парсимо, якщо ні — повертаємо як є
        if (typeof response.data === 'string' && response.data.trim().startsWith('<?xml')) {
            const result = {
                isError: false,
                content: [
                    {
                        type: "json",
                        json: parseTransactionXml(response.data)
                    }
                ]
            };
            if (args.filePath) {
                writeResultToFile(result, args.filePath);
            }
            return result;
        } else {
            const plainResult = return_response(response);
            if (args.filePath) {
                writeResultToFile(plainResult, args.filePath);
            }
            return plainResult;
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
