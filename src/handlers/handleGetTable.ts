import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';
import { XMLParser } from 'fast-xml-parser';

function parseTableXml(xml: string) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        parseAttributeValue: true,
        trimValues: true
    });
    const result = parser.parse(xml);

    // DDIC Table (TABL/DT)
    if (result['ddic:table']) {
        const t = result['ddic:table'];
        const fields = Array.isArray(t['ddic:fields']?.['ddic:field'])
            ? t['ddic:fields']['ddic:field']
            : t['ddic:fields']?.['ddic:field']
            ? [t['ddic:fields']['ddic:field']]
            : [];
        return {
            name: t['adtcore:name'],
            objectType: 'table',
            description: t['adtcore:description'],
            package: t['adtcore:packageRef']?.['adtcore:name'] || null,
            fields: fields.map(f => ({
                name: f['ddic:name'],
                dataType: f['ddic:dataType'],
                length: parseInt(f['ddic:length'], 10),
                decimals: parseInt(f['ddic:decimals'] || '0', 10),
                key: f['ddic:keyFlag'] === 'true',
                description: f['ddic:description']
            }))
        };
    }

    // fallback: return raw
    return { raw: result };
}

export async function handleGetTable(args: any) {
    try {
        if (!args?.table_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Table name is required');
        }
        const url = `${await getBaseUrl()}/sap/bc/adt/ddic/tables/${encodeSapObjectName(args.table_name)}/source/main`;
        const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
        // Якщо XML — парсимо, якщо ні — повертаємо як є
        if (typeof response.data === 'string' && response.data.trim().startsWith('<?xml')) {
            return {
                isError: false,
                content: [
                    {
                        type: "json",
                        json: parseTableXml(response.data)
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
