import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';
import { XMLParser } from 'fast-xml-parser';
import { writeResultToFile } from '../lib/writeResultToFile';

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
            const resultObj = parseStructureXml(response.data);
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
