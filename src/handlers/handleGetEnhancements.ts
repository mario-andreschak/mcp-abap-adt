import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl, logger } from '../lib/utils';

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
    object_type: 'program' | 'include';
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
            const enhNameMatch = beforeSource.match(/adtcore:name="([^"]*)"[^>]*$/);
            const enhTypeMatch = beforeSource.match(/adtcore:type="([^"]*)"[^>]*$/);
            
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
 * Determines if an object is a program or include and returns appropriate URL path
 * @param objectName - Name of the object
 * @param manualProgramContext - Optional manual program context for includes
 * @returns Object with type, basePath, and context (if needed)
 */
async function determineObjectTypeAndPath(objectName: string, manualProgramContext?: string): Promise<{type: 'program' | 'include', basePath: string, context?: string}> {
    try {
        // First try as a program
        const programUrl = `${await getBaseUrl()}/sap/bc/adt/programs/programs/${objectName}`;
        try {
            const response = await makeAdtRequest(programUrl, 'GET', 10000, {
                'Accept': 'application/vnd.sap.adt.programs.v3+xml'
            });
            
            if (response.status === 200) {
                logger.info(`${objectName} is a program`);
                return {
                    type: 'program',
                    basePath: `/sap/bc/adt/programs/programs/${objectName}/source/main/enhancements/elements`
                };
            }
        } catch (programError) {
            // If program request fails, try as include
            logger.info(`${objectName} is not a program, trying as include...`);
        }
        
        // Try as include
        const includeUrl = `${await getBaseUrl()}/sap/bc/adt/programs/includes/${objectName}`;
        const response = await makeAdtRequest(includeUrl, 'GET', 10000, {
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
                basePath: `/sap/bc/adt/programs/includes/${objectName}/source/main/enhancements/elements`,
                context: context
            };
        }
        
        throw new McpError(
            ErrorCode.InvalidParams, 
            `Could not determine object type for: ${objectName}. Object is neither a valid program nor include.`
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
 * Handler to retrieve enhancement implementations for ABAP programs/includes
 * Automatically determines if object is a program or include and handles accordingly
 * 
 * @param args - Tool arguments containing object_name and optional program parameter
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
        
        logger.info(`Getting enhancements for object: ${objectName}`, manualProgram ? `with manual program context: ${manualProgram}` : '');
        
        // Determine object type and get appropriate path and context
        const objectInfo = await determineObjectTypeAndPath(objectName, manualProgram);
        
        // Build URL based on object type
        let url = `${await getBaseUrl()}${objectInfo.basePath}`;
        
        // Add context parameter only for includes
        if (objectInfo.type === 'include' && objectInfo.context) {
            url += `?context=${encodeURIComponent(objectInfo.context)}`;
            logger.info(`Using context for include: ${objectInfo.context}`);
        }
        
        logger.info(`Final enhancement URL: ${url}`);
        
        const response = await makeAdtRequest(url, 'GET', 30000);
        
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
            
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(enhancementResponse, null, 2)
                    }
                ]
            };
        } else {
            throw new McpError(ErrorCode.InternalError, `Failed to retrieve enhancements. Status: ${response.status}`);
        }
        
    } catch (error) {
        return return_error(error);
    }
}
