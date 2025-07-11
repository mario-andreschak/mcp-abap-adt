import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';
import { XMLParser } from 'fast-xml-parser';
import { writeResultToFile } from '../lib/writeResultToFile';

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
            const resultObj = parseFunctionGroupXml(response.data);
            const result = {
                isError: false,
                content: [
                    {
                        type: "text",
                        data: JSON.stringify(resultObj, null, 2),
                        mimeType: "application/json"
                    }
                ]
            };
            if (args.filePath) {
                writeResultToFile(JSON.stringify(result, null, 2), args.filePath);
            }
            return result;
        } else {
            const plainResult = {
                isError: false,
                content: [
                    {
                        type: "text",
                        data: response.data,
                        mimeType: "text/plain"
                    }
                ]
            };
            if (args.filePath) {
                writeResultToFile(response.data, args.filePath);
            }
            return plainResult;
        }
    } catch (error) {
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    data: error instanceof Error ? error.message : String(error),
                    mimeType: "text/plain"
                }
            ]
        };
    }
}
