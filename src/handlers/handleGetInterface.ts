import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';
import { XMLParser } from 'fast-xml-parser';
import { writeResultToFile } from '../lib/writeResultToFile';


export const TOOL_DEFINITION = {
  "name": "GetInterface",
  "description": "Retrieve ABAP interface source code.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "interface_name": {
        "type": "string",
        "description": "Name of the ABAP interface"
      }
    },
    "required": [
      "interface_name"
    ]
  }
} as const;

function parseInterfaceXml(xml: string) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        parseAttributeValue: true,
        trimValues: true
    });
    const result = parser.parse(xml);

    // ADT Interface XML (INTF/OI)
    if (result['oo:interface']) {
        const i = result['oo:interface'];
        return {
            name: i['adtcore:name'],
            objectType: 'interface',
            description: i['adtcore:description'],
            package: i['adtcore:packageRef']?.['adtcore:name'] || null,
            interfaces: Array.isArray(i['oo:interfaces']?.['oo:interface'])
                ? i['oo:interfaces']['oo:interface'].map(ii => ii['adtcore:name'])
                : i['oo:interfaces']?.['oo:interface']
                ? [i['oo:interfaces']['oo:interface']['adtcore:name']]
                : [],
            methods: Array.isArray(i['oo:methods']?.['oo:method'])
                ? i['oo:methods']['oo:method'].map(m => m['adtcore:name'])
                : i['oo:methods']?.['oo:method']
                ? [i['oo:methods']['oo:method']['adtcore:name']]
                : [],
            attributes: Array.isArray(i['oo:attributes']?.['oo:attribute'])
                ? i['oo:attributes']['oo:attribute'].map(a => a['adtcore:name'])
                : i['oo:attributes']?.['oo:attribute']
                ? [i['oo:attributes']['oo:attribute']['adtcore:name']]
                : []
        };
    }

    // fallback: return raw
    return { raw: result };
}

export async function handleGetInterface(args: any) {
    try {
        if (!args?.interface_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Interface name is required');
        }
        const url = `${await getBaseUrl()}/sap/bc/adt/oo/interfaces/${encodeSapObjectName(args.interface_name)}/source/main`;
        const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
        // Якщо XML — парсимо, якщо ні — повертаємо як є
        if (typeof response.data === 'string' && response.data.trim().startsWith('<?xml')) {
            const result = {
                isError: false,
                content: [
                    {
                        type: "json",
                        json: parseInterfaceXml(response.data)
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
        return return_error(error);
    }
}
