import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl, logger } from '../lib/utils';

/**
 * Determines if an object is a program or include and returns appropriate URL path
 * @param objectName - Name of the object
 * @returns Object with type, basePath, and context (if needed)
 */
async function determineObjectTypeAndPath(objectName: string): Promise<{type: 'program' | 'include', basePath: string, context?: string}> {
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
            
            // For includes, we need to get the context
            const xmlData = response.data;
            const contextMatch = xmlData.match(/include:contextRef[^>]+adtcore:uri="([^"]+)"/);
            
            if (contextMatch && contextMatch[1]) {
                const context = contextMatch[1];
                logger.info(`Found context for include ${objectName}: ${context}`);
                return {
                    type: 'include',
                    basePath: `/sap/bc/adt/programs/includes/${objectName}/source/main/enhancements/elements`,
                    context: context
                };
            } else {
                throw new McpError(
                    ErrorCode.InvalidParams, 
                    `Could not determine parent program context for include: ${objectName}. No contextRef found in metadata.`
                );
            }
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
 * @param args - Tool arguments containing object_name
 * @returns Response with enhancement XML data or error
 */
export async function handleGetEnhancements(args: any) {
    try {
        logger.info('handleGetEnhancements called with args:', args);
        
        if (!args?.object_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Object name is required');
        }
        
        const objectName = args.object_name;
        
        logger.info(`Getting enhancements for object: ${objectName}`);
        
        // Determine object type and get appropriate path and context
        const objectInfo = await determineObjectTypeAndPath(objectName);
        
        // Build URL based on object type
        let url = `${await getBaseUrl()}${objectInfo.basePath}`;
        
        // Add context parameter only for includes
        if (objectInfo.type === 'include' && objectInfo.context) {
            url += `?context=${encodeURIComponent(objectInfo.context)}`;
            logger.info(`Using context for include: ${objectInfo.context}`);
        }
        
        logger.info(`Final enhancement URL: ${url}`);
        
        const response = await makeAdtRequest(url, 'GET', 30000);
        return return_response(response);
    } catch (error) {
        return return_error(error);
    }
}
