import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';
import { XMLParser } from 'fast-xml-parser';
import { writeResultToFile } from '../lib/writeResultToFile';

function parseClassXml(xml: string) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        parseAttributeValue: true,
        trimValues: true
    });
    const result = parser.parse(xml);

    // ADT Class XML (CLAS/OC)
    if (result['oo:class']) {
        const c = result['oo:class'];

        // Реалізації методів
        let methodImpls: any[] = [];
        const implSection = c['oo:methodImplementations']?.['oo:methodImplementation'];
        if (Array.isArray(implSection)) {
            methodImpls = implSection.map(m => ({
                name: m['adtcore:name'],
                source: m['oo:source']
            }));
        } else if (implSection) {
            methodImpls = [{
                name: implSection['adtcore:name'],
                source: implSection['oo:source']
            }];
        }

        return {
            name: c['adtcore:name'],
            objectType: 'class',
            description: c['adtcore:description'],
            package: c['adtcore:packageRef']?.['adtcore:name'] || null,
            superClass: c['oo:superClass']?.['adtcore:name'] || null,
            interfaces: Array.isArray(c['oo:interfaces']?.['oo:interface'])
                ? c['oo:interfaces']['oo:interface'].map(i => i['adtcore:name'])
                : c['oo:interfaces']?.['oo:interface']
                ? [c['oo:interfaces']['oo:interface']['adtcore:name']]
                : [],
            methods: Array.isArray(c['oo:methods']?.['oo:method'])
                ? c['oo:methods']['oo:method'].map(m => m['adtcore:name'])
                : c['oo:methods']?.['oo:method']
                ? [c['oo:methods']['oo:method']['adtcore:name']]
                : [],
            attributes: Array.isArray(c['oo:attributes']?.['oo:attribute'])
                ? c['oo:attributes']['oo:attribute'].map(a => a['adtcore:name'])
                : c['oo:attributes']?.['oo:attribute']
                ? [c['oo:attributes']['oo:attribute']['adtcore:name']]
                : [],
            methodImplementations: methodImpls
        };
    }

    // fallback: return raw
    return { raw: result };
}

export async function handleGetClass(args: any) {
    try {
        if (!args?.class_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Class name is required');
        }
        const url = `${await getBaseUrl()}/sap/bc/adt/oo/classes/${encodeSapObjectName(args.class_name)}/source/main`;
        const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
        // Якщо XML — парсимо, якщо ні — повертаємо як є
        const plainText = response.data;
        if (args.filePath) {
            writeResultToFile(plainText, args.filePath);
        }
        return plainText;
    } catch (error) {
        return return_error(error);
    }
}
