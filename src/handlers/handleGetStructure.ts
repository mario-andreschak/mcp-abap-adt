import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';
import { XMLParser } from 'fast-xml-parser';

function parseStructureXml(xml: string) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        parseAttributeValue: true,
        trimValues: true
    });
    const result = parser.parse(xml);

    // DDIC Structure (STRU/DT)
    if (result['ddic:structure']) {
        const s = result['ddic:structure'];
        const fields = Array.isArray(s['ddic:fields']?.['ddic:field'])
            ? s['ddic:fields']['ddic:field']
            : s['ddic:fields']?.['ddic:field']
            ? [s['ddic:fields']['ddic:field']]
            : [];
        return {
            name: s['adtcore:name'],
            objectType: 'structure',
            description: s['adtcore:description'],
            package: s['adtcore:packageRef']?.['adtcore:name'] || null,
            fields: fields.map(f => ({
                name: f['ddic:name'],
                dataType: f['ddic:dataType'],
                length: parseInt(f['ddic:length'], 10),
                decimals: parseInt(f['ddic:decimals'] || '0', 10),
                description: f['ddic:description']
            }))
        };
    }

    // fallback: return raw
    return { raw: result };
}

export async function handleGetStructure(args: any) {
    try {
        if (!args?.structure_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Structure name is required');
        }
        const url = `${await getBaseUrl()}/sap/bc/adt/ddic/structures/${encodeSapObjectName(args.structure_name)}/source/main`;
        const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
        // Якщо XML — парсимо, якщо ні — повертаємо як є
        if (typeof response.data === 'string' && response.data.trim().startsWith('<?xml')) {
            return {
                isError: false,
                content: [
                    {
                        type: "json",
                        json: parseStructureXml(response.data)
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
