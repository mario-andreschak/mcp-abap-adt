import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, getBaseUrl, logger, encodeSapObjectName } from '../lib/utils';
import { writeResultToFile } from '../lib/writeResultToFile';

/**
 * Interface for enhancement by name response
 */
export interface EnhancementByNameResponse {
    enhancement_spot: string;
    enhancement_name: string;
    source_code: string;
    raw_xml?: string;
}

/**
 * Parses enhancement source XML to extract the source code
 * @param xmlData - Raw XML response from ADT
 * @returns Decoded source code
 */
function parseEnhancementSourceFromXml(xmlData: string): string {
    try {
        // Look for source code in various possible formats
        
        // Try to find base64 encoded source in <source> or similar tags
        const base64SourceRegex = /<(?:source|enh:source)[^>]*>([^<]*)<\/(?:source|enh:source)>/;
        const base64Match = xmlData.match(base64SourceRegex);
        
        if (base64Match && base64Match[1]) {
            try {
                // Decode base64 source code
                const decodedSource = Buffer.from(base64Match[1], 'base64').toString('utf-8');
                return decodedSource;
            } catch (decodeError) {
                logger.warn('Failed to decode base64 source code:', decodeError);
            }
        }
        
        // Try to find plain text source code
        const textSourceRegex = /<(?:source|enh:source)[^>]*>\s*<!\[CDATA\[(.*?)\]\]>\s*<\/(?:source|enh:source)>/s;
        const textMatch = xmlData.match(textSourceRegex);
        
        if (textMatch && textMatch[1]) {
            return textMatch[1];
        }
        
        // If no specific source tags found, return the entire XML as fallback
        logger.warn('Could not find source code in expected format, returning raw XML');
        return xmlData;
        
    } catch (parseError) {
        logger.error('Failed to parse enhancement source XML:', parseError);
        return xmlData; // Return raw XML as fallback
    }
}

/**
 * Handler to retrieve a specific enhancement implementation by name in an ABAP system.
 * This function is intended for retrieving the source code of a specific enhancement implementation (requires both spot and implementation name).
 * This function uses the SAP ADT API endpoint to fetch the source code of a specific enhancement
 * implementation within a given enhancement spot. If the implementation is not found, it falls back
 * to retrieving metadata about the enhancement spot itself to provide context about the failure.
 * 
 * @param args - Tool arguments containing:
 *   - enhancement_spot: Name of the enhancement spot (e.g., 'enhoxhh'). This is a required parameter.
 *   - enhancement_name: Name of the specific enhancement implementation (e.g., 'zpartner_update_pai'). This is a required parameter.
 * @returns Response object containing:
 *   - If successful: enhancement_spot, enhancement_name, source_code, and raw_xml of the enhancement implementation.
 *   - If implementation not found: enhancement_spot, enhancement_name, status as 'not_found', a message, spot_metadata, and raw_xml of the spot.
 *   - In case of error: an error object with details about the failure.
 */
export async function handleGetEnhancementImpl(args: any) {
    try {
        logger.info('handleGetEnhancementByName called with args:', args);
        
        if (!args?.enhancement_spot) {
            throw new McpError(ErrorCode.InvalidParams, 'Enhancement spot is required');
        }
        
        if (!args?.enhancement_name) {
            throw new McpError(ErrorCode.InvalidParams, 'Enhancement name is required');
        }
        
        const enhancementSpot = args.enhancement_spot;
        const enhancementName = args.enhancement_name;
        
        logger.info(`Getting enhancement: ${enhancementName} from spot: ${enhancementSpot}`);
        
        // Build the ADT URL for the specific enhancement
        // Format: /sap/bc/adt/enhancements/{enhancement_spot}/{enhancement_name}/source/main
        const url = `${await getBaseUrl()}/sap/bc/adt/enhancements/${encodeSapObjectName(enhancementSpot)}/${encodeSapObjectName(enhancementName)}/source/main`;
        
        logger.info(`Enhancement URL: ${url}`);
        
        const response = await makeAdtRequestWithTimeout(url, 'GET', 'default');
        
        if (response.status === 200 && response.data) {
            // Parse the XML to extract source code
            const sourceCode = parseEnhancementSourceFromXml(response.data);
            
            const enhancementResponse: EnhancementByNameResponse = {
                enhancement_spot: enhancementSpot,
                enhancement_name: enhancementName,
                source_code: sourceCode,
                raw_xml: response.data // Include raw XML for debugging if needed
            };
            
            const result = {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(enhancementResponse, null, 2)
                    }
                ]
            };
            if (args.filePath) {
                writeResultToFile(result, args.filePath);
            }
            return result;
        } else {
            logger.warn(`Enhancement ${enhancementName} not found in spot ${enhancementSpot}. Status: ${response.status}. Attempting to retrieve spot metadata as fallback.`);
            // Fallback to retrieve metadata about the enhancement spot
            const spotUrl = `${await getBaseUrl()}/sap/bc/adt/enhancements/${encodeSapObjectName(enhancementSpot)}`;
            logger.info(`Fallback enhancement spot URL: ${spotUrl}`);
            
            const spotResponse = await makeAdtRequestWithTimeout(spotUrl, 'GET', 'default', {
                'Accept': 'application/vnd.sap.adt.enhancements.v1+xml'
            });
            
            if (spotResponse.status === 200 && spotResponse.data) {
                // Parse metadata if possible
                const metadata: { description?: string } = {};
                const descriptionMatch = spotResponse.data.match(/<adtcore:description>([^<]*)<\/adtcore:description>/);
                if (descriptionMatch && descriptionMatch[1]) {
                    metadata.description = descriptionMatch[1];
                }
                
                const fallbackResult = {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                enhancement_spot: enhancementSpot,
                                enhancement_name: enhancementName,
                                status: "not_found",
                                message: `Enhancement implementation ${enhancementName} not found in spot ${enhancementSpot}.`,
                                spot_metadata: metadata,
                                raw_xml: spotResponse.data
                            }, null, 2)
                        }
                    ]
                };
                if (args.filePath) {
                    writeResultToFile(fallbackResult, args.filePath);
                }
                return fallbackResult;
            } else {
                throw new McpError(
                    ErrorCode.InternalError, 
                    `Failed to retrieve enhancement ${enhancementName} from spot ${enhancementSpot}. Status: ${response.status}. Fallback to retrieve spot metadata also failed. Status: ${spotResponse.status}`
                );
            }
        }
        
    } catch (error) {
        return return_error(error);
    }
}
