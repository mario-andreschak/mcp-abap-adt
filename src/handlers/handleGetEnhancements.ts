import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, logger, encodeSapObjectName, fetchNodeStructure } from '../lib/utils';
import { writeResultToFile } from '../lib/writeResultToFile';


export const TOOL_DEFINITION = {
  "name": "GetEnhancements",
  "description": "Retrieve a list of enhancements for a given ABAP object.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "object_name": {
        "type": "string",
        "description": "Name of the ABAP object"
      },
      "object_type": {
        "type": "string",
        "description": "Type of the ABAP object"
      }
    },
    "required": [
      "object_name",
      "object_type"
    ]
  }
} as const;

/**
 * Interface for enhancement implementation data
 */
export interface EnhancementImplementation {
    name: string;
    type: string;
    sourceCode?: string;
    description?: string;
}

/**
 * Interface for parsed enhancement response
 */
export interface EnhancementResponse {
    object_name: string;
    object_type: 'program' | 'include' | 'class';
    context?: string;
    enhancements: EnhancementImplementation[];
    detailed?: boolean;
    total_enhancements?: number;
}

/**
 * Parses enhancement XML to extract enhancement implementations with their source code
 * @param xmlData - Raw XML response from ADT
 * @returns Array of enhancement implementations
 */
export function parseEnhancementsFromXml(xmlData: string): EnhancementImplementation[] {
    const enhancements: EnhancementImplementation[] = [];
    
    try {
        // Extract <enh:source> elements which contain the base64 encoded enhancement source code
        const sourceRegex = /<enh:source[^>]*>([^<]*)<\/enh:source>/g;
        let match;
        let index = 0;
        
        while ((match = sourceRegex.exec(xmlData)) !== null) {
            const enhancement: EnhancementImplementation = {
                name: `enhancement_${index + 1}`, // Default name if not found in attributes
                type: 'enhancement',
            };
            
            // Try to find enhancement name and type from parent elements or attributes
            const sourceStart = match.index;
            
            // Look backwards for parent enhancement element with name/type attributes
            const beforeSource = xmlData.substring(0, sourceStart);
            
            // Try multiple patterns to find enhancement name
            // Pattern 1: adtcore:name attribute
            let enhNameMatch = beforeSource.match(/adtcore:name="([^"]*)"[^>]*$/);
            // Pattern 2: enh:name attribute  
            if (!enhNameMatch) {
                enhNameMatch = beforeSource.match(/enh:name="([^"]*)"[^>]*$/);
            }
            // Pattern 3: name attribute
            if (!enhNameMatch) {
                enhNameMatch = beforeSource.match(/name="([^"]*)"[^>]*$/);
            }
            // Pattern 4: Look for enhancement implementation name in nearby elements
            if (!enhNameMatch) {
                // Look for enhancement implementation tag with name
                const enhImplMatch = beforeSource.match(/<[^>]*enhancement[^>]*name="([^"]*)"[^>]*>/i);
                if (enhImplMatch && enhImplMatch[1]) {
                    enhNameMatch = [enhImplMatch[0], enhImplMatch[1]];
                }
            }
            
            // Try multiple patterns to find enhancement type
            let enhTypeMatch = beforeSource.match(/adtcore:type="([^"]*)"[^>]*$/);
            if (!enhTypeMatch) {
                enhTypeMatch = beforeSource.match(/enh:type="([^"]*)"[^>]*$/);
            }
            if (!enhTypeMatch) {
                enhTypeMatch = beforeSource.match(/type="([^"]*)"[^>]*$/);
            }
            
            if (enhNameMatch && enhNameMatch[1]) {
                enhancement.name = enhNameMatch[1];
            }
            if (enhTypeMatch && enhTypeMatch[1]) {
                enhancement.type = enhTypeMatch[1];
            }
            
            // Extract and decode the base64 source code
            const base64Source = match[1];
            if (base64Source) {
                try {
                    // Decode base64 source code
                    const decodedSource = Buffer.from(base64Source, 'base64').toString('utf-8');
                    enhancement.sourceCode = decodedSource;
                } catch (decodeError) {
                    logger.warn(`Failed to decode source code for enhancement ${enhancement.name}:`, decodeError);
                    enhancement.sourceCode = base64Source; // Keep original if decode fails
                }
            }
            
            enhancements.push(enhancement);
            index++;
        }
        
        logger.info(`Parsed ${enhancements.length} enhancement implementations`);
        return enhancements;
        
    } catch (parseError) {
        logger.error('Failed to parse enhancement XML:', parseError);
        return [];
    }
}

/**
 * Determines if an object is a program, include, or class and returns appropriate URL path
 * @param objectName - Name of the object
 * @param manualProgramContext - Optional manual program context for includes
 * @returns Object with type, basePath, and context (if needed)
 */
async function determineObjectTypeAndPath(objectName: string, manualProgramContext?: string): Promise<{type: 'program' | 'include' | 'class', basePath: string, context?: string}> {
    try {
        // First try as a class
        const classUrl = `${await getBaseUrl()}/sap/bc/adt/oo/classes/${encodeSapObjectName(objectName)}`;
        try {
            const response = await makeAdtRequestWithTimeout(classUrl, 'GET', 'csrf', {
                'Accept': 'application/vnd.sap.adt.oo.classes.v4+xml'
            });
            
            if (response.status === 200) {
                logger.info(`${objectName} is a class`);
                return {
                    type: 'class',
                    basePath: `/sap/bc/adt/oo/classes/${encodeSapObjectName(objectName)}/source/main/enhancements/elements`
                };
            }
        } catch (classError) {
            // If class request fails, try as program
            logger.info(`${objectName} is not a class, trying as program...`);
        }
        
        // Try as a program
        const programUrl = `${await getBaseUrl()}/sap/bc/adt/programs/programs/${encodeSapObjectName(objectName)}`;
        try {
            const response = await makeAdtRequestWithTimeout(programUrl, 'GET', 'csrf', {
                'Accept': 'application/vnd.sap.adt.programs.v3+xml'
            });
            
            if (response.status === 200) {
                logger.info(`${objectName} is a program`);
                return {
                    type: 'program',
                    basePath: `/sap/bc/adt/programs/programs/${encodeSapObjectName(objectName)}/source/main/enhancements/elements`
                };
            }
        } catch (programError) {
            // If program request fails, try as include
            logger.info(`${objectName} is not a program, trying as include...`);
        }
        
        // Try as include
        const includeUrl = `${await getBaseUrl()}/sap/bc/adt/programs/includes/${encodeSapObjectName(objectName)}`;
        const response = await makeAdtRequestWithTimeout(includeUrl, 'GET', 'csrf', {
            'Accept': 'application/vnd.sap.adt.programs.includes.v2+xml'
        });
        
        if (response.status === 200) {
            logger.info(`${objectName} is an include`);
            
            let context: string;
            
            // Use manual program context if provided
            if (manualProgramContext) {
                context = `/sap/bc/adt/programs/programs/${manualProgramContext}`;
                logger.info(`Using manual program context for include ${objectName}: ${context}`);
            } else {
                // Auto-determine context from metadata
                const xmlData = response.data;
                const contextMatch = xmlData.match(/include:contextRef[^>]+adtcore:uri="([^"]+)"/);
                
                if (contextMatch && contextMatch[1]) {
                    context = contextMatch[1];
                    logger.info(`Found auto-determined context for include ${objectName}: ${context}`);
                } else {
                    throw new McpError(
                        ErrorCode.InvalidParams, 
                        `Could not determine parent program context for include: ${objectName}. No contextRef found in metadata. Consider providing the 'program' parameter manually.`
                    );
                }
            }
            
            return {
                type: 'include',
                basePath: `/sap/bc/adt/programs/includes/${encodeSapObjectName(objectName)}/source/main/enhancements/elements`,
                context: context
            };
        }
        
        throw new McpError(
            ErrorCode.InvalidParams, 
            `Could not determine object type for: ${objectName}. Object is neither a valid class, program, nor include.`
        );
        
    } catch (error) {
        if (error instanceof McpError) {
            throw error;
        }
        logger.error(`Failed to determine object type for ${objectName}:`, error);
        throw new McpError(
            ErrorCode.InvalidParams, 
            `Failed to determine object type for: ${objectName}. ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

/**
 * Parses XML response to extract includes information
 * @param xmlData XML response data
 * @returns Array of include objects with name and node_id
 */
function parseIncludesFromXml(xmlData: string): Array<{name: string, node_id: string, label: string}> {
    const includes: Array<{name: string, node_id: string, label: string}> = [];
    
    try {
        // Simple regex-based parsing for XML
        // Look for OBJECT_TYPE entries that contain "PROG/I" (includes)
        const objectTypeRegex = /<SEU_ADT_OBJECT_TYPE_INFO>(.*?)<\/SEU_ADT_OBJECT_TYPE_INFO>/gs;
        const matches = xmlData.match(objectTypeRegex);
        
        if (matches) {
            for (const match of matches) {
                // Check if this is an include type
                if (match.includes('<OBJECT_TYPE>PROG/I</OBJECT_TYPE>')) {
                    const nodeIdMatch = match.match(/<NODE_ID>(\d+)<\/NODE_ID>/);
                    const labelMatch = match.match(/<OBJECT_TYPE_LABEL>(.*?)<\/OBJECT_TYPE_LABEL>/);
                    
                    if (nodeIdMatch && labelMatch) {
                        includes.push({
                            name: 'PROG/I',
                            node_id: nodeIdMatch[1],
                            label: labelMatch[1]
                        });
                    }
                }
            }
        }
    } catch (error) {
        logger.warn('Error parsing XML for includes:', error);
    }
    
    return includes;
}

/**
 * Parses XML response to extract actual include names from node structure
 * @param xmlData XML response data
 * @returns Array of include names
 */
function parseIncludeNamesFromXml(xmlData: string): string[] {
    const includeNames: string[] = [];
    
    try {
        // Look for SEU_ADT_REPOSITORY_OBJ_NODE entries with OBJECT_TYPE PROG/I
        const nodeRegex = /<SEU_ADT_REPOSITORY_OBJ_NODE>(.*?)<\/SEU_ADT_REPOSITORY_OBJ_NODE>/gs;
        const nodeMatches = xmlData.match(nodeRegex);
        
        if (nodeMatches) {
            for (const nodeMatch of nodeMatches) {
                // Check if this node is for includes (PROG/I)
                if (nodeMatch.includes('<OBJECT_TYPE>PROG/I</OBJECT_TYPE>')) {
                    // Extract the object name
                    const nameMatch = nodeMatch.match(/<OBJECT_NAME>([^<]+)<\/OBJECT_NAME>/);
                    if (nameMatch && nameMatch[1].trim()) {
                        const includeName = nameMatch[1].trim();
                        // Decode URL-encoded names if needed
                        const decodedName = decodeURIComponent(includeName);
                        includeNames.push(decodedName);
                    }
                }
            }
        }
        
        // If no nodes found, try alternative parsing for OBJECT_NAME tags
        if (includeNames.length === 0) {
            const objectNameRegex = /<OBJECT_NAME>([^<]+)<\/OBJECT_NAME>/g;
            let match;
            while ((match = objectNameRegex.exec(xmlData)) !== null) {
                const name = match[1].trim();
                if (name && name.length > 0) {
                    const decodedName = decodeURIComponent(name);
                    includeNames.push(decodedName);
                }
            }
        }
    } catch (error) {
        logger.warn('Error parsing XML for include names:', error);
    }
    
    return [...new Set(includeNames)]; // Remove duplicates
}

/**
 * Internal function to get includes list using SAP ADT API
 * @param objectName - Name of the object
 * @param objectType - Type of the object ('program' | 'include' | 'class')
 * @returns Array of include names
 */
async function getIncludesListInternal(objectName: string, objectType: 'program' | 'include' | 'class'): Promise<string[]> {
    try {
        // Classes don't have includes in the traditional sense
        if (objectType === 'class') {
            logger.info(`Classes don't have includes. Returning empty list for class '${objectName}'`);
            return [];
        }

        // For includes, we need to determine the parent program
        let parentName = objectName;
        let parentTechName = objectName;
        let parentType = 'PROG/P';

        if (objectType === 'include') {
            // For includes, we assume they belong to a program with similar name
            // This is a simplification - in real scenarios, you might need additional logic
            // to determine the actual parent program
            logger.warn(`Include processing: assuming parent program for include ${objectName}`);
        }

        // Step 1: Get root node structure to find includes node (with timeout)
        const rootResponse = await Promise.race([
            fetchNodeStructure(
                parentName.toUpperCase(),
                parentTechName.toUpperCase(),
                parentType,
                '000000', // Root node
                true // with descriptions
            ),
            new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error(`Timeout: Failed to get root node structure for ${objectName} within 10000ms`)), 10000)
            )
        ]);

        // Step 2: Parse response to find includes node ID
        const includesInfo = parseIncludesFromXml(rootResponse.data);
        const includesNode = includesInfo.find(info => info.name === 'PROG/I');
        
        if (!includesNode) {
            logger.info(`No includes node found for ${objectType} '${objectName}'`);
            return [];
        }

        // Step 3: Get includes list using the found node ID (with timeout)
        const includesResponse = await Promise.race([
            fetchNodeStructure(
                parentName.toUpperCase(),
                parentTechName.toUpperCase(),
                parentType,
                includesNode.node_id,
                true // with descriptions
            ),
            new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error(`Timeout: Failed to get includes list for ${objectName} within 10000ms`)), 10000)
            )
        ]);

        // Step 4: Parse the includes response to extract include names
        const includeNames = parseIncludeNamesFromXml(includesResponse.data);
        
        logger.info(`Found ${includeNames.length} includes for ${objectType} '${objectName}' using SAP ADT API`);
        return includeNames;

    } catch (error) {
        logger.error(`Failed to get includes list for ${objectType} '${objectName}':`, error);
        return [];
    }
}

/**
 * Gets enhancements for a single object (program or include)
 * @param objectName - Name of the object
 * @param manualProgramContext - Optional manual program context for includes
 * @returns Enhancement response for the single object
 */
async function getEnhancementsForSingleObject(objectName: string, manualProgramContext?: string): Promise<EnhancementResponse> {
    logger.info(`Getting enhancements for single object: ${objectName}`, manualProgramContext ? `with manual program context: ${manualProgramContext}` : '');
    
    // Determine object type and get appropriate path and context
    const objectInfo = await determineObjectTypeAndPath(objectName, manualProgramContext);
    
    // Build URL based on object type
    let url = `${await getBaseUrl()}${objectInfo.basePath}`;
    
    // Add context parameter only for includes
    if (objectInfo.type === 'include' && objectInfo.context) {
        url += `?context=${encodeURIComponent(objectInfo.context)}`;
        logger.info(`Using context for include: ${objectInfo.context}`);
    }
    
    logger.info(`Final enhancement URL: ${url}`);
    
    const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
    
    if (response.status === 200 && response.data) {
        // Parse the XML to extract enhancement implementations
        const enhancements = parseEnhancementsFromXml(response.data);
        
        const enhancementResponse: EnhancementResponse = {
            object_name: objectName,
            object_type: objectInfo.type,
            context: objectInfo.context,
            enhancements: enhancements
        };
        
        return enhancementResponse;
    } else {
        throw new McpError(ErrorCode.InternalError, `Failed to retrieve enhancements for ${objectName}. Status: ${response.status}`);
    }
}

/**
 * Filters enhancement response to show minimal information
 */
function filterMinimalEnhancements(response: any): any {
    if (response.objects) {
        // For nested results, filter each object
        const filteredObjects = response.objects
            .filter((obj: any) => obj.enhancements && obj.enhancements.length > 0) // Only objects with enhancements
            .map((obj: any) => ({
                object_name: obj.object_name,
                object_type: obj.object_type,
                enhancements: obj.enhancements.map((enh: any) => ({
                    name: enh.name,
                    type: enh.type,
                    // Include source code only if it's short (< 500 chars) or first 200 chars
                    sourceCode: enh.sourceCode ? 
                        (enh.sourceCode.length <= 500 ? enh.sourceCode : enh.sourceCode.substring(0, 200) + '...[truncated]') 
                        : undefined
                }))
            }));
        
        return {
            ...response,
            detailed: false,
            total_objects_with_enhancements: filteredObjects.length,
            total_objects_analyzed: response.total_objects_analyzed,
            filtered_out: response.total_objects_analyzed - filteredObjects.length,
            objects: filteredObjects
        };
    } else {
        // For single object results
        const filteredEnhancements = response.enhancements ? response.enhancements.map((enh: any) => ({
            name: enh.name,
            type: enh.type,
            sourceCode: enh.sourceCode ? 
                (enh.sourceCode.length <= 500 ? enh.sourceCode : enh.sourceCode.substring(0, 200) + '...[truncated]') 
                : undefined
        })) : [];
        
        return {
            object_name: response.object_name,
            object_type: response.object_type,
            context: response.context,
            detailed: false,
            total_enhancements: filteredEnhancements.length,
            enhancements: filteredEnhancements
        };
    }
}

/**
 * Handler to retrieve enhancement implementations for ABAP programs/includes
 * Automatically determines if object is a program or include and handles accordingly
 * 
 * @param args - Tool arguments containing:
 *   - object_name: Name of the ABAP object
 *   - program: Optional manual program context for includes  
 *   - include_nested: Optional boolean - if true, also searches enhancements in all nested includes
 *   - detailed: Optional boolean - if false (default), returns minimal info; if true, returns full details including raw XML
 *   - timeout: Optional timeout in milliseconds for each ADT request (default: 30000ms = 30s)
 *   - max_includes: Optional maximum number of includes to process (default: 50)
 * @returns Response with parsed enhancement data or error
 */
export async function handleGetEnhancements(args: any) {
    try {
        logger.info('handleGetEnhancements called with args:', args);
        
        if (!args?.object_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Object name is required');
        }
        
        const objectName = args.object_name;
        const manualProgram = args.program; // Optional manual program context for includes
        const includeNested = args.include_nested === true; // Optional boolean for recursive include search
        const isDetailed = args.detailed === true; // Optional boolean for detailed output
        
        // Simple timeout logic: one timeout for all ADT requests
        const requestTimeout = args.timeout ? parseInt(args.timeout, 10) : 30000; // Timeout for each ADT request (default: 30s)
        const maxIncludes = args.max_includes ? parseInt(args.max_includes, 10) : 50; // Maximum number of includes to process
        
        logger.info(`Getting enhancements for object: ${objectName}`, {
            manualProgram: manualProgram || '(not provided)',
            includeNested: includeNested,
            requestTimeout: requestTimeout,
            maxIncludes: maxIncludes
        });
        
        // Get enhancements for the main object
        const mainEnhancementResponse = await getEnhancementsForSingleObject(objectName, manualProgram);
        
        if (!includeNested) {
            // Return only main object enhancements
            let response = mainEnhancementResponse;
            
            // Apply filtering if not detailed
            if (!isDetailed) {
                response = filterMinimalEnhancements(response);
            } else {
                // Add detailed flag for consistency
                response = { ...response, detailed: true };
            }
            
const result = {
    isError: false,
    content: [
        {
            type: "text",
            text: JSON.stringify(response)
        }
    ]
};
            if (args.filePath) {
                writeResultToFile(JSON.stringify(result, null, 2), args.filePath);
            }
            return result;
        }
        
        // If include_nested is true, also get enhancements from all nested includes
        logger.info('Searching for nested includes and their enhancements...');
        
        // Simplified nested processing - no recursion, just flat list
        const processNestedIncludes = async () => {
            // Get flat list of all includes using the optimized GetIncludesList logic
            let includesList = await getIncludesListInternal(objectName, mainEnhancementResponse.object_type);
            
            logger.info(`Found ${includesList.length} includes (flat list, no recursion):`, includesList);
            
            // Limit the number of includes to process to avoid timeout
            if (includesList.length > maxIncludes) {
                logger.warn(`Too many includes found (${includesList.length}). Limiting to first ${maxIncludes} includes to avoid timeout.`);
                includesList = includesList.slice(0, maxIncludes);
            }
            
            // Collect all enhancement responses
            const allEnhancementResponses: EnhancementResponse[] = [mainEnhancementResponse];
            
            // Simple sequential processing with individual timeouts
            for (const includeName of includesList) {
                try {
                    logger.info(`Getting enhancements for include: ${includeName}`);
                    
                    // Create a promise with individual timeout for each include
                    const includeEnhancementsPromise = getEnhancementsForSingleObject(includeName, manualProgram);
                    
                    const includeEnhancements = await createPromiseWithTimeout(
                        includeEnhancementsPromise,
                        requestTimeout,
                        `Timeout: Failed to get enhancements for include ${includeName} within ${requestTimeout}ms`
                    );
                    
                    allEnhancementResponses.push(includeEnhancements);
                } catch (error) {
                    logger.warn(`Failed to get enhancements for include ${includeName}:`, error);
                    // Continue with other includes even if one fails
                }
            }
            
            return allEnhancementResponses;
        };
        
        // Execute nested processing without total timeout - each request has its own timeout
        let allEnhancementResponses: EnhancementResponse[];
        try {
            allEnhancementResponses = await processNestedIncludes();
        } catch (error) {
            logger.error('Nested enhancement processing failed or timed out:', error);
            // Return partial results with just the main object
            const fallbackResult = {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            main_object: {
                                name: objectName,
                                type: mainEnhancementResponse.object_type
                            },
                            include_nested: true,
                            error: error instanceof Error ? error.message : String(error),
                            partial_result: true,
                            total_objects_analyzed: 1,
                            total_enhancements_found: mainEnhancementResponse.enhancements.length,
                            objects: [mainEnhancementResponse]
                        }, null, 2)
                    }
                ]
            };
            if (args.filePath) {
                writeResultToFile(fallbackResult, args.filePath);
            }
            return fallbackResult;
        }
        
        // Create combined response
        let combinedResponse: any = {
            main_object: {
                name: objectName,
                type: mainEnhancementResponse.object_type
            },
            include_nested: true,
            total_objects_analyzed: allEnhancementResponses.length,
            total_enhancements_found: allEnhancementResponses.reduce((sum, resp) => sum + resp.enhancements.length, 0),
            objects: allEnhancementResponses
        };
        
        // Apply filtering if not detailed
        if (!isDetailed) {
            combinedResponse = filterMinimalEnhancements(combinedResponse);
        } else {
            // Add detailed flag for consistency
            combinedResponse = { ...combinedResponse, detailed: true };
        }
        
const result = {
    isError: false,
    content: [
        {
            type: "text",
            text: JSON.stringify(combinedResponse)
        }
    ]
};
        if (args.filePath) {
            writeResultToFile(JSON.stringify(result, null, 2), args.filePath);
        }
        return result;
        
    } catch (error) {
        return return_error(error);
    }
}

/**
 * Creates a promise with timeout that properly cleans up the timeout when the promise resolves
 * @param promise - The promise to wrap with timeout
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Error message to use when timeout occurs
 * @returns Promise that resolves with the original promise result or rejects with timeout error
 */
function createPromiseWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(errorMessage));
        }, timeoutMs);
    });
    
    return Promise.race([
        promise.then(result => {
            // Clear timeout when main promise resolves successfully
            clearTimeout(timeoutId);
            return result;
        }).catch(error => {
            // Clear timeout when main promise rejects
            clearTimeout(timeoutId);
            throw error;
        }),
        timeoutPromise
    ]);
}
