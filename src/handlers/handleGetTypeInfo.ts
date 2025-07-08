import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';
import { XMLParser } from 'fast-xml-parser';

function parseTypeInfoXml(xml: string) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        parseAttributeValue: true,
        trimValues: true
    });
    const result = parser.parse(xml);

    // Data Element (DTEL/DE)
    if (result['blue:wbobj'] && result['blue:wbobj']['dtel:dataElement']) {
        const wb = result['blue:wbobj'];
        const dtel = wb['dtel:dataElement'];
        return {
            name: wb['adtcore:name'],
            objectType: 'data_element',
            description: wb['adtcore:description'],
            dataType: dtel['dtel:dataType'],
            length: parseInt(dtel['dtel:dataTypeLength'], 10),
            decimals: parseInt(dtel['dtel:dataTypeDecimals'], 10),
            domain: dtel['dtel:typeName'],
            package: wb['adtcore:packageRef']?.['adtcore:name'] || null,
            labels: {
                short: dtel['dtel:shortFieldLabel'],
                medium: dtel['dtel:mediumFieldLabel'],
                long: dtel['dtel:longFieldLabel'],
                heading: dtel['dtel:headingFieldLabel']
            }
        };
    }

    // Domain (DOMA/DD) via repository informationsystem
    if (result['opr:objectProperties'] && result['opr:objectProperties']['opr:object']) {
        const obj = result['opr:objectProperties']['opr:object'];
        return {
            name: obj['name'],
            objectType: 'domain',
            description: obj['text'],
            package: obj['package'],
            type: obj['type'],
        };
    }

    // Table Type (not implemented, fallback)
    return { raw: result };
}

export async function handleGetTypeInfo(args: any) {
    try {
        if (!args?.type_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Type name is required');
        }
    } catch (error) {
        return return_error(error);
    }

    try {
        const url = `${await getBaseUrl()}/sap/bc/adt/ddic/domains/${encodeSapObjectName(args.type_name)}/source/main`;
        const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
        const result = {
            isError: false,
            content: [
                {
                    type: "json",
                    json: parseTypeInfoXml(response.data)
                }
            ]
        };
        if (args.filePath) {
            const fs = require('fs');
            fs.writeFileSync(args.filePath, JSON.stringify(result, null, 2), 'utf-8');
        }
        return result;
    } catch (error) {
        // no domain found, try data element
        try {
            const url = `${await getBaseUrl()}/sap/bc/adt/ddic/dataelements/${encodeSapObjectName(args.type_name)}`;
            const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
            const result = {
                isError: false,
                content: [
                    {
                        type: "json",
                        json: parseTypeInfoXml(response.data)
                    }
                ]
            };
            if (args.filePath) {
                const fs = require('fs');
                fs.writeFileSync(args.filePath, JSON.stringify(result, null, 2), 'utf-8');
            }
            return result;
        } catch (error) {
            // no data element found, try table type
            try {
                const url = `${await getBaseUrl()}/sap/bc/adt/ddic/tabletypes/${encodeSapObjectName(args.type_name)}`;
                const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
                const result = {
                    isError: false,
                    content: [
                        {
                            type: "json",
                            json: parseTypeInfoXml(response.data)
                        }
                    ]
                };
                if (args.filePath) {
                    const fs = require('fs');
                    fs.writeFileSync(args.filePath, JSON.stringify(result, null, 2), 'utf-8');
                }
                return result;
            } catch (error) {
                // fallback: try repository informationsystem for domain
                try {
                    const baseUrl = await getBaseUrl();
                    const uri = encodeURIComponent(`/sap/bc/adt/ddic/domains/${args.type_name.toLowerCase()}`);
                    const url = `${baseUrl}/sap/bc/adt/repository/informationsystem/objectproperties/values?uri=${uri}`;
                    const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
                        const result = {
                            isError: false,
                            content: [
                                {
                                    type: "json",
                                    json: parseTypeInfoXml(response.data)
                                }
                            ]
                        };
                        if (args.filePath) {
                            const fs = require('fs');
                            fs.writeFileSync(args.filePath, JSON.stringify(result, null, 2), 'utf-8');
                        }
                        return result;
                } catch (error) {
                    return return_error(error);
                }
            }
        }
    }
}

module.exports = { handleGetTypeInfo };
