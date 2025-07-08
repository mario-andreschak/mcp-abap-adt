import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, getBaseUrl, encodeSapObjectName } from '../lib/utils';
import { XMLParser } from 'fast-xml-parser';

function parseFunctionXml(xml: string) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        parseAttributeValue: true,
        trimValues: true
    });
    const result = parser.parse(xml);

    // ADT Function Module XML (FUGR/FM)
    if (result['fu:functionModule']) {
        const f = result['fu:functionModule'];
        // Параметри
        const params = (section) => {
            const arr = f[section]?.['fu:parameter'];
            if (!arr) return [];
            return Array.isArray(arr)
                ? arr.map(p => ({
                    name: p['fu:name'],
                    type: p['fu:type'],
                    typing: p['fu:typing'],
                    reference: p['fu:reference'],
                    default: p['fu:default'],
                    optional: p['fu:optional'] === 'true',
                    description: p['fu:description']
                }))
                : [{
                    name: arr['fu:name'],
                    type: arr['fu:type'],
                    typing: arr['fu:typing'],
                    reference: arr['fu:reference'],
                    default: arr['fu:default'],
                    optional: arr['fu:optional'] === 'true',
                    description: arr['fu:description']
                }];
        };
        // Таблиці
        const tables = params('fu:tables');
        // Імпорт/експорт/змінні
        const importing = params('fu:importing');
        const exporting = params('fu:exporting');
        const changing = params('fu:changing');
        // Винятки
        const exceptions = f['fu:exceptions']?.['fu:exception'];
        const excArr = !exceptions ? [] : Array.isArray(exceptions)
            ? exceptions.map(e => e['fu:name'])
            : [exceptions['fu:name']];
        // Source code
        const source = f['fu:source'];

        return {
            name: f['adtcore:name'],
            objectType: 'function_module',
            description: f['adtcore:description'],
            group: f['adtcore:parentRef']?.['adtcore:name'] || null,
            importing,
            exporting,
            changing,
            tables,
            exceptions: excArr,
            source
        };
    }

    // fallback: return raw
    return { raw: result };
}

export async function handleGetFunction(args: any) {
    try {
        if (!args?.function_name || !args?.function_group) {
            throw new McpError(ErrorCode.InvalidParams, 'Function name and group are required');
        }
        const url = `${await getBaseUrl()}/sap/bc/adt/functions/groups/${encodeSapObjectName(args.function_group)}/fmodules/${encodeSapObjectName(args.function_name)}/source/main`;
        const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
        // Якщо XML — парсимо і повертаємо JSON, якщо ні — повертаємо plain text напряму
        if (typeof response.data === 'string' && response.data.trim().startsWith('<?xml')) {
            return {
                isError: false,
                content: [
                    {
                        type: "json",
                        json: parseFunctionXml(response.data)
                    }
                ]
            };
        } else {
            // Plain text: повертаємо як є (без JSON-обгортки)
            return response.data;
        }
    } catch (error) {
        return return_error(error);
    }
}
