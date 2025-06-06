import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';

interface StartPosition {
    row: number;
    col: number;
}

interface EndPosition {
    row: number;
    col: number;
}

interface WhereUsedReference {
    name: string;
    type: string;
    uri: string;
    parentUri?: string;
    isResult?: boolean;
    canHaveChildren?: boolean;
    usageInformation?: string;
    objectIdentifier?: string;
}

interface WhereUsedArgs {
    object_name: string;
    object_type: 'class' | 'program' | 'include' | 'function' | 'interface';
    start_position?: StartPosition;
    end_position?: EndPosition;
}

/**
 * Fetches a CSRF token by doing a plain-text GET on the discovery endpoint
 */
async function fetchCsrfToken(): Promise<string> {
    const baseUrl = await getBaseUrl();
    const srcUrl = `${baseUrl}/sap/bc/adt/discovery`;
    
    try {
        const response = await makeAdtRequestWithTimeout(
            srcUrl,
            'GET',
            'csrf',
            undefined,
            undefined
        );
        
        const token = response.headers['x-csrf-token'];
        if (!token) {
            throw new McpError(ErrorCode.InternalError, 'Failed to fetch CSRF token');
        }
        
        return token;
    } catch (error) {
        throw new McpError(ErrorCode.InternalError, `Failed to fetch CSRF token: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Builds the URI for the object based on its type and name
 */
function buildObjectUri(objectName: string, objectType: string): string {
    const encodedName = encodeSapObjectName(objectName);
    
    switch (objectType) {
        case 'class':
            return `/sap/bc/adt/oo/classes/${encodedName}`;
        case 'program':
            return `/sap/bc/adt/programs/programs/${encodedName}`;
        case 'include':
            return `/sap/bc/adt/programs/includes/${encodedName}`;
        case 'function':
            return `/sap/bc/adt/functions/groups/${encodedName}`;
        case 'interface':
            return `/sap/bc/adt/oo/interfaces/${encodedName}`;
        default:
            throw new McpError(ErrorCode.InvalidParams, `Unsupported object type: ${objectType}`);
    }
}

/**
 * Parses XML response and extracts where-used references
 */
function parseWhereUsedResponse(xmlData: string): WhereUsedReference[] {
    const references: WhereUsedReference[] = [];
    
    try {
        // Simple XML parsing for usageReferences response
        // Look for referencedObject elements
        const objectMatches = xmlData.match(/<usageReferences:referencedObject[^>]*>(.*?)<\/usageReferences:referencedObject>/gs);
        
        if (objectMatches) {
            for (const objectMatch of objectMatches) {
                // Extract attributes from the referencedObject element
                const uriMatch = objectMatch.match(/uri="([^"]*)"/);
                const parentUriMatch = objectMatch.match(/parentUri="([^"]*)"/);
                const isResultMatch = objectMatch.match(/isResult="([^"]*)"/);
                const canHaveChildrenMatch = objectMatch.match(/canHaveChildren="([^"]*)"/);
                const usageInformationMatch = objectMatch.match(/usageInformation="([^"]*)"/);
                
                const uri = uriMatch ? uriMatch[1] : '';
                const parentUri = parentUriMatch ? parentUriMatch[1] : undefined;
                const isResult = isResultMatch ? isResultMatch[1] === 'true' : undefined;
                const canHaveChildren = canHaveChildrenMatch ? canHaveChildrenMatch[1] === 'true' : undefined;
                const usageInformation = usageInformationMatch ? usageInformationMatch[1] : undefined;
                
                // Extract adtObject attributes
                const adtObjectMatch = objectMatch.match(/<usageReferences:adtObject[^>]*>/);
                let name = '';
                let type = '';
                
                if (adtObjectMatch) {
                    const nameMatch = adtObjectMatch[0].match(/adtcore:name="([^"]*)"/);
                    const typeMatch = adtObjectMatch[0].match(/adtcore:type="([^"]*)"/);
                    
                    name = nameMatch ? nameMatch[1] : '';
                    type = typeMatch ? typeMatch[1] : '';
                }
                
                // Extract objectIdentifier if present
                const objectIdentifierMatch = objectMatch.match(/<objectIdentifier>([^<]*)<\/objectIdentifier>/);
                const objectIdentifier = objectIdentifierMatch ? objectIdentifierMatch[1] : undefined;
                
                const reference: WhereUsedReference = {
                    name,
                    type,
                    uri
                };
                
                if (parentUri) reference.parentUri = parentUri;
                if (isResult !== undefined) reference.isResult = isResult;
                if (canHaveChildren !== undefined) reference.canHaveChildren = canHaveChildren;
                if (usageInformation) reference.usageInformation = usageInformation;
                if (objectIdentifier) reference.objectIdentifier = objectIdentifier;
                
                references.push(reference);
            }
        }
    } catch (error) {
        throw new McpError(ErrorCode.InternalError, `Failed to parse XML response: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return references;
}

export async function handleGetWhereUsed(args: any) {
    try {
        // Validate required parameters
        if (!args?.object_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Object name is required');
        }
        
        if (!args?.object_type) {
            throw new McpError(ErrorCode.InvalidParams, 'Object type is required');
        }
        
        const validTypes = ['class', 'program', 'include', 'function', 'interface'];
        if (!validTypes.includes(args.object_type)) {
            throw new McpError(ErrorCode.InvalidParams, `Object type must be one of: ${validTypes.join(', ')}`);
        }
        
        const typedArgs = args as WhereUsedArgs;
        
        // 1. Fetch CSRF token
        const csrfToken = await fetchCsrfToken();
        
        // 2. Build the object URI
        let objectUri = buildObjectUri(typedArgs.object_name, typedArgs.object_type);
        
        // 3. If start_position is provided, add fragment for specific position search
        if (typedArgs.start_position) {
            const { row, col } = typedArgs.start_position;
            if (typeof row !== 'number' || typeof col !== 'number') {
                throw new McpError(ErrorCode.InvalidParams, 'Start position must include numeric row and col values');
            }
            
            let fragment = `start=${row},${col}`;
            if (typedArgs.end_position) {
                const { row: erow, col: ecol } = typedArgs.end_position;
                if (typeof erow !== 'number' || typeof ecol !== 'number') {
                    throw new McpError(ErrorCode.InvalidParams, 'End position must include numeric row and col values if provided');
                }
                fragment += `;end=${erow},${ecol}`;
            }
            
            // For classes, add source/main path and fragment
            if (typedArgs.object_type === 'class') {
                objectUri += '/source/main?version=active#' + fragment;
            } else {
                objectUri += '#' + fragment;
            }
        }
        
        // 4. Prepare the usageReferences request
        const baseUrl = await getBaseUrl();
        const endpoint = `${baseUrl}/sap/bc/adt/repository/informationsystem/usageReferences`;
        
        const requestBody = '<?xml version="1.0" encoding="UTF-8"?><usagereferences:usageReferenceRequest xmlns:usagereferences="http://www.sap.com/adt/ris/usageReferences"><usagereferences:affectedObjects/></usagereferences:usageReferenceRequest>';
        
        // 5. Make the POST request
        const response = await makeAdtRequestWithTimeout(
            endpoint,
            'POST',
            'default',
            requestBody,
            {
                uri: objectUri
            }
        );
        
        // 6. Parse the XML response
        const references = parseWhereUsedResponse(response.data);
        
        // 7. Format the response
        const formattedResponse = {
            object_name: typedArgs.object_name,
            object_type: typedArgs.object_type,
            object_uri: objectUri,
            start_position: typedArgs.start_position,
            end_position: typedArgs.end_position,
            references: references,
            total_references: references.length
        };
        
        return {
            isError: false,
            content: [
                {
                    type: "text",
                    text: JSON.stringify(formattedResponse, null, 2),
                },
            ],
        };
        
    } catch (error) {
        return return_error(error);
    }
}
