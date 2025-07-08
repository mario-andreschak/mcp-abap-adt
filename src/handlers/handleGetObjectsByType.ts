import { McpError, ErrorCode } from '../lib/utils';
import { fetchNodeStructure, return_error, return_response } from '../lib/utils';
import { writeResultToFile } from '../lib/writeResultToFile';

/**
 * Parses XML response to extract object names from node structure
 * @param xmlData XML response data
 * @returns Array of object info with name, type, and URI
 */
function parseObjectNamesFromXml(xmlData: string): Array<{
    name: string, 
    type: string, 
    tech_name: string, 
    uri?: string
}> {
    const objects: Array<{name: string, type: string, tech_name: string, uri?: string}> = [];
    
    try {
        // Look for SEU_ADT_REPOSITORY_OBJ_NODE entries
        const nodeRegex = /<SEU_ADT_REPOSITORY_OBJ_NODE>(.*?)<\/SEU_ADT_REPOSITORY_OBJ_NODE>/gs;
        const nodeMatches = xmlData.match(nodeRegex);
        
        if (nodeMatches) {
            for (const nodeMatch of nodeMatches) {
                const objectTypeMatch = nodeMatch.match(/<OBJECT_TYPE>([^<]+)<\/OBJECT_TYPE>/);
                const objectNameMatch = nodeMatch.match(/<OBJECT_NAME>([^<]+)<\/OBJECT_NAME>/);
                const techNameMatch = nodeMatch.match(/<TECH_NAME>([^<]+)<\/TECH_NAME>/);
                const uriMatch = nodeMatch.match(/<OBJECT_URI>([^<]+)<\/OBJECT_URI>/);
                
                if (objectTypeMatch && objectNameMatch) {
                    const objectName = decodeURIComponent(objectNameMatch[1]);
                    const techName = techNameMatch ? decodeURIComponent(techNameMatch[1]) : objectName;
                    const uri = uriMatch ? decodeURIComponent(uriMatch[1]) : undefined;
                    
                    objects.push({
                        name: objectName,
                        type: objectTypeMatch[1],
                        tech_name: techName,
                        uri: uri
                    });
                }
            }
        }
    } catch (error) {
        console.warn('Error parsing XML for object names:', error);
    }
    
    return objects;
}

export async function handleGetObjectsByType(args: any) {
    try {
        const { parent_name, parent_tech_name, parent_type, node_id, format, with_short_descriptions } = args;

        if (!parent_name || typeof parent_name !== 'string' || parent_name.trim() === '') {
            throw new McpError(ErrorCode.InvalidParams, 'Parameter "parent_name" (string) is required and cannot be empty.');
        }
        
        if (!parent_tech_name || typeof parent_tech_name !== 'string' || parent_tech_name.trim() === '') {
            throw new McpError(ErrorCode.InvalidParams, 'Parameter "parent_tech_name" (string) is required and cannot be empty.');
        }
        
        if (!parent_type || typeof parent_type !== 'string' || parent_type.trim() === '') {
            throw new McpError(ErrorCode.InvalidParams, 'Parameter "parent_type" (string) is required and cannot be empty.');
        }

        if (!node_id || typeof node_id !== 'string' || node_id.trim() === '') {
            throw new McpError(ErrorCode.InvalidParams, 'Parameter "node_id" (string) is required and cannot be empty.');
        }

        const withDescriptions = with_short_descriptions !== undefined ? Boolean(with_short_descriptions) : true;
        const outputFormat = format || 'parsed'; // 'raw' or 'parsed'

        // Get specific node structure
        const response = await fetchNodeStructure(
            parent_name.toUpperCase(),
            parent_tech_name.toUpperCase(),
            parent_type,
            node_id,
            withDescriptions
        );

        if (outputFormat === 'raw') {
            const plainResult = return_response(response);
            if (args.filePath) {
                writeResultToFile(plainResult, args.filePath);
            }
            return plainResult;
        }

        // Parse and format the response
        const objects = parseObjectNamesFromXml(response.data);
        
        if (objects.length === 0) {
            const mockResponse = {
                data: `No objects found for node_id '${node_id}' in ${parent_type} '${parent_name}'.`,
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {}
            } as any;
            const plainResult = return_response(mockResponse);
            if (args.filePath) {
                writeResultToFile(plainResult, args.filePath);
            }
            return plainResult;
        }

        // Create formatted response
        let responseText = '';
        responseText = `Found ${objects.length} objects for node_id '${node_id}' in ${parent_type} '${parent_name}':\n\n`;
        
        // Group by object type if there are multiple types
        const objectTypes = [...new Set(objects.map(obj => obj.type))];
        
        if (objectTypes.length > 1) {
            for (const objType of objectTypes) {
                const typeObjects = objects.filter(obj => obj.type === objType);
                responseText += `📁 Type: ${objType} (${typeObjects.length} objects)\n`;
                
                for (const obj of typeObjects) {
                    responseText += `   • ${obj.name}`;
                    if (obj.tech_name !== obj.name) {
                        responseText += ` (${obj.tech_name})`;
                    }
                    if (obj.uri) {
                        responseText += `\n     URI: ${obj.uri}`;
                    }
                    responseText += '\n';
                }
                responseText += '\n';
            }
        } else {
            // Single type, simpler format
            const objType = objectTypes[0];
            responseText += `📁 Object Type: ${objType}\n\n`;
            
            for (const obj of objects) {
                responseText += `   • ${obj.name}`;
                if (obj.tech_name !== obj.name) {
                    responseText += ` (${obj.tech_name})`;
                }
                if (obj.uri) {
                    responseText += `\n     URI: ${obj.uri}`;
                }
                responseText += '\n';
            }
        }
        
        // Add summary
        responseText += `\n📊 Summary: ${objects.length} objects found\n`;
        if (objectTypes.length > 1) {
            for (const objType of objectTypes) {
                const count = objects.filter(obj => obj.type === objType).length;
                responseText += `   ${objType}: ${count} objects\n`;
            }
        }

        const mockResponse = {
            data: responseText,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {}
        } as any;

        const finalResult = return_response(mockResponse);
        if (args.filePath) {
            writeResultToFile(finalResult, args.filePath);
        }
        return finalResult;

    } catch (error) {
        return return_error(error);
    }
}
