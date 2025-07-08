import { McpError, ErrorCode } from '../lib/utils';
import { fetchNodeStructure, return_error, return_response } from '../lib/utils';
import { writeResultToFile } from '../lib/writeResultToFile';

/**
 * Parses XML response to extract object type information
 * @param xmlData XML response data
 * @returns Array of object type info with name, node_id, label, and category
 */
function parseObjectTypesFromXml(xmlData: string): Array<{
    object_type: string, 
    node_id: string, 
    label: string, 
    category: string
}> {
    const objectTypes: Array<{object_type: string, node_id: string, label: string, category: string}> = [];
    
    try {
        // Look for SEU_ADT_OBJECT_TYPE_INFO entries
        const objectTypeRegex = /<SEU_ADT_OBJECT_TYPE_INFO>(.*?)<\/SEU_ADT_OBJECT_TYPE_INFO>/gs;
        const matches = xmlData.match(objectTypeRegex);
        
        if (matches) {
            for (const match of matches) {
                const objectTypeMatch = match.match(/<OBJECT_TYPE>([^<]+)<\/OBJECT_TYPE>/);
                const nodeIdMatch = match.match(/<NODE_ID>(\d+)<\/NODE_ID>/);
                const labelMatch = match.match(/<OBJECT_TYPE_LABEL>(.*?)<\/OBJECT_TYPE_LABEL>/);
                const categoryMatch = match.match(/<CATEGORY_TAG>([^<]+)<\/CATEGORY_TAG>/);
                
                if (objectTypeMatch && nodeIdMatch && labelMatch) {
                    objectTypes.push({
                        object_type: objectTypeMatch[1],
                        node_id: nodeIdMatch[1],
                        label: labelMatch[1],
                        category: categoryMatch ? categoryMatch[1] : 'unknown'
                    });
                }
            }
        }
    } catch (error) {
        console.warn('Error parsing XML for object types:', error);
    }
    
    return objectTypes;
}

/**
 * Maps filter types to SAP object types
 */
function getObjectTypeFilter(filterType?: string): string[] {
    if (!filterType) {
        return []; // Return all types
    }
    
    const filterMap: Record<string, string[]> = {
        'enhancement': ['ENHO/XH', 'ENHS/XS'],
        'include': ['PROG/I', 'FUGR/I'],
        'screen': ['PROG/PS'],
        'dialog': ['DIAL/A'],
        'transaction': ['TRAN/T'],
        'class': ['PROG/PL'],
        'subroutine': ['PROG/PU'],
        'module': ['PROG/PM', 'PROG/PO'],
        'macro': ['PROG/PK'],
        'type': ['PROG/PY', 'PROG/PT'],
        'text': ['PROG/PX'],
        'gui': ['PROG/PC', 'PROG/PZ'],
        'event': ['PROG/PE'],
        'field': ['PROG/PD'],
        'typegroup': ['PROG/PG']
    };
    
    return filterMap[filterType.toLowerCase()] || [];
}

/**
 * Determines the most likely SAP object type based on object name patterns
 */
function guessObjectType(objectName: string): string {
    const name = objectName.toUpperCase();
    
    // Common SAP object type patterns
    if (name.startsWith('CL_') || name.startsWith('/') && name.includes('/CL_')) {
        return 'CLAS/OC'; // Class
    }
    if (name.startsWith('IF_') || name.startsWith('/') && name.includes('/IF_')) {
        return 'INTF/OI'; // Interface
    }
    if (name.startsWith('SAPM')) {
        return 'PROG/P'; // Program (SAPM prefix)
    }
    
    // Function groups are typically 3-4 characters (SLIS, RSSB, etc.)
    if (name.match(/^[A-Z]{3,4}$/)) {
        return 'FUGR/F'; // Function Group
    }
    
    // Programs are typically longer names
    if (name.match(/^[A-Z]\w{4,}$/)) {
        return 'PROG/P'; // Program
    }
    
    // Default to program - most common case
    return 'PROG/P';
}

export async function handleGetRelatedObjectTypes(args: any) {
    try {
        const { object_name, object_filter, with_short_descriptions } = args;

        if (!object_name || typeof object_name !== 'string' || object_name.trim() === '') {
            throw new McpError(ErrorCode.InvalidParams, 'Parameter "object_name" (string) is required and cannot be empty.');
        }

        const objectNameUpper = object_name.toUpperCase();
        const withDescriptions = with_short_descriptions !== undefined ? Boolean(with_short_descriptions) : true;
        const filterTypes = getObjectTypeFilter(object_filter);

        // Auto-determine object type
        const objectType = guessObjectType(objectNameUpper);

        // Get root node structure to find available object types
        const rootResponse = await fetchNodeStructure(
            objectNameUpper,
            objectNameUpper, // tech_name same as name
            objectType,
            '000000', // Root node
            withDescriptions
        );

        // Parse response to find object types
        const objectTypes = parseObjectTypesFromXml(rootResponse.data);
        
        // Filter object types if filter is specified
        const filteredObjectTypes = filterTypes.length > 0 
            ? objectTypes.filter(obj => filterTypes.includes(obj.object_type))
            : objectTypes;

        if (filteredObjectTypes.length === 0) {
            const filterMessage = object_filter 
                ? ` matching filter '${object_filter}'`
                : '';
            const mockResponse = {
                data: `No object types found${filterMessage} in ${objectType} '${objectNameUpper}'.`,
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
        const filterMessage = object_filter ? ` (filtered by: ${object_filter})` : '';
        responseText = `Found ${filteredObjectTypes.length} object types in ${objectType} '${objectNameUpper}'${filterMessage}:\n\n`;
        
        // Group by category
        const categories = [...new Set(filteredObjectTypes.map(obj => obj.category))];
        
        for (const category of categories) {
            const categoryTypes = filteredObjectTypes.filter(obj => obj.category === category);
            responseText += `📁 Category: ${category}\n`;
            
            for (const objType of categoryTypes) {
                responseText += `   • ${objType.label} (${objType.object_type})\n`;
                responseText += `     Node ID: ${objType.node_id}\n`;
            }
            responseText += '\n';
        }
        
        // Add summary
        responseText += '📊 Summary:\n';
        for (const category of categories) {
            const count = filteredObjectTypes.filter(obj => obj.category === category).length;
            responseText += `   ${category}: ${count} types\n`;
        }
        
        responseText += `\n💡 Use GetObjectsByType with node_id to get specific objects of each type.`;

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
