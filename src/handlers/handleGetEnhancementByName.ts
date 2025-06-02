import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, getBaseUrl, logger, encodeSapObjectName } from '../lib/utils';

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
 * Handler to retrieve a specific enhancement implementation by name
 * Uses the ADT API endpoint for reading enhancement source code directly
 * 
 * @param args - Tool arguments containing:
 *   - enhancement_spot: Name of the enhancement spot (e.g., 'enhoxhh')
 *   - enhancement_name: Name of the specific enhancement implementation (e.g., 'zpartner_update_pai')
 * @returns Response with enhancement source code or error
 */
export async function handleGetEnhancementByName(args: any) {
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
            
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(enhancementResponse, null, 2)
                    }
                ]
            };
        } else {
            throw new McpError(
                ErrorCode.InternalError, 
                `Failed to retrieve enhancement ${enhancementName} from spot ${enhancementSpot}. Status: ${response.status}`
            );
        }
        
    } catch (error) {
        return return_error(error);
    }
}
