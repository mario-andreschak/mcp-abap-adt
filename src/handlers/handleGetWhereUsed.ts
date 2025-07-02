import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, getBaseUrl, encodeSapObjectName } from '../lib/utils';

interface WhereUsedReference {
    name: string;
    type: string;
    uri: string;
    parentUri?: string;
    isResult?: boolean;
    canHaveChildren?: boolean;
    usageInformation?: string;
    objectIdentifier?: string;
    originalName?: string; // For storing original name when resolved
}

interface WhereUsedArgs {
    object_name: string;
    object_type: string; // Now supports any ADT object type, e.g. 'class', 'program', 'table', 'bdef', etc.
    detailed?: boolean;
}


/**
 * Builds the URI for the object based on its type and name.
 * 
 * Supported object_type values:
 * - 'class'      → ABAP class
 * - 'program'    → ABAP program
 * - 'include'    → ABAP include
 * - 'function'   → ABAP function group
 * - 'interface'  → ABAP interface
 * - 'package'    → ABAP package
 * - 'table'/'TABL' → ABAP table (DDIC)
 * - 'bdef'/'BDEF' → ABAP Behavior Definition
 * 
 * You can extend this list by adding new cases for other ADT object types (e.g. CDS, DT, etc.).
 * 
 * If an unsupported object_type is provided, an error will be thrown.
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
        case 'package':
            return `/sap/bc/adt/packages/${encodedName}`;
        case 'table':
        case 'tabl':
        case 'TABL':
            return `/sap/bc/adt/ddic/tables/${encodedName}`;
        case 'bdef':
        case 'BDEF':
            return `/sap/bc/adt/bo/behaviordefinitions/${encodedName}`;
        // Add more object types here as needed (e.g. CDS, DT, etc.)
        default:
            throw new McpError(ErrorCode.InvalidParams, `Unsupported object type: ${objectType}`);
    }
}

/**
 * Resolves object identifier to human-readable name using quickSearch API
 */
async function resolveObjectIdentifier(objectIdentifier: string): Promise<string | null> {
    try {
        const baseUrl = await getBaseUrl();
        const query = encodeURIComponent(`${objectIdentifier}*`);
        const endpoint = `${baseUrl}/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=${query}&maxResults=1`;
        
        const response = await makeAdtRequestWithTimeout(endpoint, 'GET', 'default');
        
        // Parse XML response to extract description
        const descriptionMatch = response.data.match(/adtcore:description="([^"]*)"/);
        if (descriptionMatch) {
            return descriptionMatch[1];
        }
        
        return null;
    } catch (error) {
        // If resolution fails, return null (we'll use original name)
        return null;
    }
}

/**
 * Checks if a reference is internal class structure (self-reference)
 */
function isInternalClassStructure(ref: WhereUsedReference): boolean {
    // Check objectIdentifier for self-references
    if (ref.objectIdentifier) {
        // Pattern: CL_BUS_ABSTRACT_MAIN_SCREEN===CP means it's the class itself
        // Pattern: CL_BUS_ABSTRACT_MAIN_SCREEN===CO means it's used somewhere else
        if (ref.objectIdentifier.includes('===CP') || ref.objectIdentifier.includes('===CI') || ref.objectIdentifier.includes('===CU')) {
            return true; // Internal structure
        }
    }
    
    // Check if parentUri points to the same class as the reference
    if (ref.parentUri && ref.uri) {
        const parentClass = ref.parentUri.match(/\/classes\/([^\/]+)/)?.[1];
        const refClass = ref.uri.match(/\/classes\/([^\/]+)/)?.[1];
        
        if (parentClass && refClass && parentClass === refClass) {
            // Additional check: if it's a method/attribute within the same class
            if (ref.uri.includes('#type=CLAS%2FOM') || ref.uri.includes('#type=CLAS%2FOA')) {
                return true; // Internal method or attribute
            }
        }
    }
    
    return false;
}

/**
 * Enhances references with resolved names for better readability
 */
async function enhanceReferencesWithNames(references: WhereUsedReference[]): Promise<WhereUsedReference[]> {
    const enhancedReferences = [...references];
    
    // Process references that have cryptic names but objectIdentifiers
    for (let i = 0; i < enhancedReferences.length; i++) {
        const ref = enhancedReferences[i];
        
        // If name is empty or cryptic and we have objectIdentifier, try to resolve it
        if (ref.objectIdentifier && (!ref.name || ref.name.length === 0)) {
            const resolvedName = await resolveObjectIdentifier(ref.objectIdentifier);
            if (resolvedName) {
                enhancedReferences[i] = {
                    ...ref,
                    name: resolvedName,
                    originalName: ref.name // Keep original for reference
                };
            }
        }
    }
    
    return enhancedReferences;
}

/**
 * Filters references to show only the most relevant ones (excludes packages and internal components)
 */
function filterMinimalReferences(references: WhereUsedReference[]): WhereUsedReference[] {
    return references.filter(ref => {
        // PRIORITY 1: Always show enhancement implementations (most important for developers)
        if (ref.type === 'ENHO/XHH') {
            return true;
        }
        
        // PRIORITY 2: Show main results that are marked as important (but not packages)
        if (ref.isResult === true && ref.type !== 'DEVC/K') {
            return true;
        }
        
        // PRIORITY 3: Show function modules with direct usage (real implementations)
        if (ref.type === 'FUGR/FF' && ref.usageInformation && ref.usageInformation.includes('gradeDirect')) {
            return true;
        }
        
        // HIDE EVERYTHING ELSE IN MINIMAL MODE:
        
        // Hide ALL packages - they're organizational, not functional usage
        if (ref.type === 'DEVC/K') {
            return false;
        }
        
        // Hide internal class structure (self-references)
        if (isInternalClassStructure(ref)) {
            return false;
        }
        
        // Hide ALL class internal structure (sections, methods, attributes)
        if (ref.name === 'Public Section' || ref.name === 'Private Section' || ref.name === 'Protected Section') {
            return false;
        }
        
        // Hide ALL internal class components
        if (ref.type && ref.type.startsWith('CLAS/')) {
            return false;
        }
        
        // Hide ALL items with empty type (usually internal structure)
        if (!ref.type) {
            return false;
        }
        
        // Hide function groups (show only specific functions)
        if (ref.type === 'FUGR/F') {
            return false;
        }
        
        // Hide programs unless they're marked as main results
        if (ref.type === 'PROG/P' && !ref.isResult) {
            return false;
        }
        
        // Hide includes unless they're marked as main results
        if (ref.type === 'PROG/I' && !ref.isResult) {
            return false;
        }
        
        // Show only if it's a main result or enhancement
        return ref.isResult === true || ref.type === 'ENHO/XHH';
    });
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
        
        // Accept any object_type, validation is now handled in buildObjectUri
        const typedArgs = args as WhereUsedArgs;
        
        // 1. Build the object URI
        const objectUri = buildObjectUri(typedArgs.object_name, typedArgs.object_type);
        
        // 2. Prepare the usageReferences request
        const baseUrl = await getBaseUrl();
        const endpoint = `${baseUrl}/sap/bc/adt/repository/informationsystem/usageReferences?uri=${encodeURIComponent(objectUri)}`;
        
        const requestBody = '<?xml version="1.0" encoding="UTF-8"?><usagereferences:usageReferenceRequest xmlns:usagereferences="http://www.sap.com/adt/ris/usageReferences"><usagereferences:affectedObjects/></usagereferences:usageReferenceRequest>';
        
        // 3. Make the POST request
        const response = await makeAdtRequestWithTimeout(
            endpoint,
            'POST',
            'default',
            requestBody
        );
        
        // 5. Parse the XML response
        const allReferences = parseWhereUsedResponse(response.data);
        
        // 6. Filter references if detailed=false (default)
        const isDetailed = typedArgs.detailed === true;
        let references = allReferences;
        
        if (!isDetailed) {
            references = filterMinimalReferences(allReferences);
        }
        
        // 7. Format the response based on detailed mode
        let formattedReferences;
        if (isDetailed) {
            // Detailed mode: show all fields
            formattedReferences = references;
        } else {
            // Minimal mode: show only name and type
            formattedReferences = references.map(ref => ({
                name: ref.name,
                type: ref.type
            }));
        }
        
        const formattedResponse = {
            object_name: typedArgs.object_name,
            object_type: typedArgs.object_type,
            object_uri: objectUri,
            detailed: isDetailed,
            total_references: references.length,
            total_found: allReferences.length,
            filtered_out: isDetailed ? 0 : allReferences.length - references.length,
            references: formattedReferences
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
