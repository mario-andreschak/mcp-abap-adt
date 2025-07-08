import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';
import { XMLParser } from 'fast-xml-parser';

function parseFunctionGroupXml(xml: string) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        parseAttributeValue: true,
        trimValues: true
    });
    const result = parser.parse(xml);

    // ADT Function Group XML (FUGR)
    if (result['fu:functionGroup']) {
        const fg = result['fu:functionGroup'];
        const modules = fg['fu:functionModules']?.['fu:functionModule'];
        const moduleArr = !modules ? [] : Array.isArray(modules)
            ? modules.map(m => m['adtcore:name'])
            : [modules['adtcore:name']];
        return {
            name: fg['adtcore:name'],
            objectType: 'function_group',
            description: fg['adtcore:description'],
            package: fg['adtcore:packageRef']?.['adtcore:name'] || null,
            functionModules: moduleArr
        };
    }

    // fallback: return raw
    return { raw: result };
}

export async function handleGetFunctionGroup(args: any) {
    try {
        if (!args?.function_group) {
            throw new McpError(ErrorCode.InvalidParams, 'Function Group is required');
        }
        const url = `${await getBaseUrl()}/sap/bc/adt/functions/groups/${encodeSapObjectName(args.function_group)}/source/main`;
        const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
        // Якщо XML — парсимо, якщо ні — повертаємо як є
        if (typeof response.data === 'string' && response.data.trim().startsWith('<?xml')) {
            return {
                isError: false,
                content: [
                    {
                        type: "json",
                        json: parseFunctionGroupXml(response.data)
                    }
                ]
            };
        } else {
            return return_response(response);
        }
    } catch (error) {
        return return_error(error);
    }
}
