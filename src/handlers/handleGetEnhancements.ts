import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl, logger } from '../lib/utils';

/**
 * Interface for enhancement implementation data
 */
interface EnhancementImplementation {
    name: string;
    type: string;
    sourceCode?: string;
    description?: string;
}

/**
 * Interface for parsed enhancement response
 */
interface EnhancementResponse {
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
function parseEnhancementsFromXml(xmlData: string): EnhancementImplementation[] {
    const enhancements: EnhancementImplementation[] = [];
    
    try {
        // Extract enhancement implementation elements
        // Look for enhancement implementation nodes
        const enhRegex = /<enh:implementation[^>]*name="([^"]*)"[^>]*type="([^"]*)"[^>]*>/g;
        let match;
        
        while ((match = enhRegex.exec(xmlData)) !== null) {
            const enhancement: EnhancementImplementation = {
                name: match[1] || '',
                type: match[2] || '',
            };
            
            // Find the start position of this enhancement implementation
            const enhStart = match.index;
            
            // Find the corresponding closing tag
            const enhEnd = xmlData.indexOf('</enh:implementation>', enhStart);
            if (enhEnd === -1) continue;
            
            // Extract the content between the tags
            const enhContent = xmlData.substring(enhStart, enhEnd + '</enh:implementation>'.length);
            
            // Extract description if available
            const descMatch = enhContent.match(/<enh:description[^>]*>([^<]*)<\/enh:description>/);
            if (descMatch && descMatch[1]) {
                enhancement.description = descMatch[1];
            }
            
            // Extract source code from <enh:source> tags (base64 encoded)
            const sourceMatch = enhContent.match(/<enh:source[^>]*>([^<]*)<\/enh:source>/);
            if (sourceMatch && sourceMatch[1]) {
                try {
                    // Decode base64 source code
                    const decodedSource = Buffer.from(sourceMatch[1], 'base64').toString('utf-8');
                    enhancement.sourceCode = decodedSource;
                } catch (decodeError) {
                    logger.warn(`Failed to decode source code for enhancement ${enhancement.name}:`, decodeError);
                    enhancement.sourceCode = sourceMatch[1]; // Keep original if decode fails
                }
            }
            
            enhancements.push(enhancement);
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
