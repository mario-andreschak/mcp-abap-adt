import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';
import convert from 'xml-js';

// GetPackage builds its own JSON array (extractedData) from a parsed XML
// response rather than a plain string, so it can't hand the raw axios
// response straight to return_response() the way other handlers do. Wrap it
// in a minimal AxiosResponse-shaped object instead so it still goes through
// the same shared size cap/pagination as everything else - for a package
// with a large number of members, this array can exceed the safe response
// size just as easily as a large source file can.
function asAxiosResponse(data: any): AxiosResponse {
    return { data } as AxiosResponse;
}

export async function handleGetPackage(args: any) {
    try {
        if (!args?.package_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Package name is required');
        }

        const nodeContentsUrl = `${await getBaseUrl()}/sap/bc/adt/repository/nodestructure`;
        const encodedPackageName = encodeURIComponent(args.package_name);
        const nodeContentsParams = {
            parent_type: "DEVC/K",
            parent_name: encodedPackageName,
            withShortDescriptions: true
        };

        const package_structure_response = await makeAdtRequest(nodeContentsUrl, 'POST', 30000, undefined, nodeContentsParams);
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

        return return_response(asAxiosResponse(extractedData), args);

    } catch (error) {
        return return_error(error);
    }
}
