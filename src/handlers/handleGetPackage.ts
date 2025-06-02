import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl } from '../lib/utils';
import convert from 'xml-js';

export async function handleGetPackage(args: any) {
    try {
        if (!args?.package_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Package name is required');
        }

        const nodeContentsUrl = `${await getBaseUrl()}/sap/bc/adt/repository/nodestructure`;
        const nodeContentsParams = {
            parent_type: "DEVC/K",
            parent_name: args.package_name,
            withShortDescriptions: true
        };

        const package_structure_response = await makeAdtRequestWithTimeout(nodeContentsUrl, 'POST', 'default', undefined, nodeContentsParams);
        const result = convert.xml2js(package_structure_response.data, {compact: true});
        
        const nodes = result["asx:abap"]?.["asx:values"]?.DATA?.TREE_CONTENT?.SEU_ADT_REPOSITORY_OBJ_NODE || [];
        const extractedData = (Array.isArray(nodes) ? nodes : [nodes]).filter(node => 
            node.OBJECT_NAME?._text && node.OBJECT_URI?._text
        ).map(node => ({
            OBJECT_TYPE: node.OBJECT_TYPE._text,
            OBJECT_NAME: node.OBJECT_NAME._text,
            OBJECT_DESCRIPTION: node.DESCRIPTION?._text,
            OBJECT_URI: node.OBJECT_URI._text
        }));

        return {
            isError: false,
            content: [{
                type: 'text',
                text: JSON.stringify(extractedData)
            }]
        };

    } catch (error) {
        return return_error(error);
    }
}
