import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, logger, encodeSapObjectName } from '../lib/utils';
import { handleGetIncludesList } from './handleGetIncludesList';

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
    raw_xml?: string;
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
            enhancements: enhancements,
            raw_xml: response.data // Include raw XML for debugging if needed
        };
        
        return enhancementResponse;
    } else {
        throw new McpError(ErrorCode.InternalError, `Failed to retrieve enhancements for ${objectName}. Status: ${response.status}`);
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
        
        logger.info(`Getting enhancements for object: ${objectName}`, {
            manualProgram: manualProgram || '(not provided)',
            includeNested: includeNested
        });
        
        // Get enhancements for the main object
        const mainEnhancementResponse = await getEnhancementsForSingleObject(objectName, manualProgram);
        
        if (!includeNested) {
            // Return only main object enhancements
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(mainEnhancementResponse, null, 2)
                    }
                ]
            };
        }
        
        // If include_nested is true, also get enhancements from all nested includes
        logger.info('Searching for nested includes and their enhancements...');
        
        // Get all includes recursively
        const includesResult = await handleGetIncludesList({
            object_name: objectName,
            object_type: mainEnhancementResponse.object_type
        });
        
        // Parse the includes list from the result
        let includesList: string[] = [];
        if (includesResult.content && includesResult.content[0] && includesResult.content[0].text) {
            const includesText = includesResult.content[0].text;
            // Extract include names from the text response
            const includesMatch = includesText.match(/Found \d+ includes[^:]*:\n(.+)/s);
            if (includesMatch && includesMatch[1]) {
                includesList = includesMatch[1].split('\n').map(line => line.trim()).filter(line => line.length > 0);
            }
        }
        
        logger.info(`Found ${includesList.length} nested includes:`, includesList);
        
        // Collect all enhancement responses
        const allEnhancementResponses: EnhancementResponse[] = [mainEnhancementResponse];
        
        // Get enhancements for each include
        for (const includeName of includesList) {
            try {
                logger.info(`Getting enhancements for nested include: ${includeName}`);
                const includeEnhancements = await getEnhancementsForSingleObject(includeName, manualProgram);
                allEnhancementResponses.push(includeEnhancements);
            } catch (error) {
                logger.warn(`Failed to get enhancements for include ${includeName}:`, error);
                // Continue with other includes even if one fails
            }
        }
        
        // Create combined response
        const combinedResponse = {
            main_object: {
                name: objectName,
                type: mainEnhancementResponse.object_type
            },
            include_nested: true,
            total_objects_analyzed: allEnhancementResponses.length,
            total_enhancements_found: allEnhancementResponses.reduce((sum, resp) => sum + resp.enhancements.length, 0),
            objects: allEnhancementResponses
        };
        
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(combinedResponse, null, 2)
                }
            ]
        };
        
    } catch (error) {
        return return_error(error);
    }
}
