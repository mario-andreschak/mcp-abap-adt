import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequestWithTimeout, return_error, getBaseUrl, logger, encodeSapObjectName } from '../lib/utils';

/**
 * Interface for enhancement spot response
 */
export interface EnhancementSpotResponse {
    enhancement_spot: string;
    metadata: {
        description?: string;
        type?: string;
        status?: string;
    };
    raw_xml?: string;
}

/**
 * Parses enhancement spot XML to extract metadata and function (implementation) descriptions.
 * @param xmlData - Raw XML response from ADT
 * @returns Metadata object with description, type, status, and functions (implementations)
 */
function parseEnhancementSpotMetadata(xmlData: string): any {
    const metadata: any = {};
    try {
        // Spot name, description, type, package
        const nameMatch = xmlData.match(/adtcore:name="([^"]*)"/);
        if (nameMatch && nameMatch[1]) metadata.name = nameMatch[1];
        const descMatch = xmlData.match(/adtcore:description="([^"]*)"/);
        if (descMatch && descMatch[1]) metadata.description = descMatch[1];
        const typeMatch = xmlData.match(/adtcore:type="([^"]*)"/);
        if (typeMatch && typeMatch[1]) metadata.type = typeMatch[1];
        const pkgMatch = xmlData.match(/adtcore:packageRef[^>]+adtcore:name="([^"]*)"/);
        if (pkgMatch && pkgMatch[1]) metadata.package = pkgMatch[1];

        // Interface reference
        const ifaceMatch = xmlData.match(/<enhs:interface[^>]*adtcore:name="([^"]*)"/);
        if (ifaceMatch && ifaceMatch[1]) metadata.interface = ifaceMatch[1];

        // BAdI definitions
        const badiDefs: Array<any> = [];
        const badiDefRegex = /<enhs:badiDefinition[\s\S]*?<\/enhs:badiDefinition>/g;
        let badiMatch;
        while ((badiMatch = badiDefRegex.exec(xmlData)) !== null) {
            const block = badiMatch[0];
            const badiName = (block.match(/enhs:name="([^"]*)"/) || [])[1];
            const badiShort = (block.match(/enhs:shorttext="([^"]*)"/) || [])[1];
            const badiIface = (block.match(/<enhs:interface[^>]*adtcore:name="([^"]*)"/) || [])[1];
            badiDefs.push({
                name: badiName,
                shorttext: badiShort,
                interface: badiIface
            });
        }
        if (badiDefs.length > 0) metadata.badi_definitions = badiDefs;

        // All atom:link rels
        const links: Array<any> = [];
        const linkRegex = /<atom:link ([^>]+)\/>/g;
        let linkMatch;
        while ((linkMatch = linkRegex.exec(xmlData)) !== null) {
            const attrs = linkMatch[1];
            const href = (attrs.match(/href="([^"]*)"/) || [])[1];
            const rel = (attrs.match(/rel="([^"]*)"/) || [])[1];
            const type = (attrs.match(/type="([^"]*)"/) || [])[1];
            const title = (attrs.match(/title="([^"]*)"/) || [])[1];
            links.push({ href, rel, type, title });
        }
        if (links.length > 0) metadata.links = links;

        logger.info(`Parsed structured metadata for enhancement spot:`, metadata);
        return metadata;
    } catch (parseError) {
        logger.error('Failed to parse enhancement spot XML metadata:', parseError);
        return {};
    }
}

/**
 * Handler to retrieve metadata for a specific enhancement spot in an ABAP system.
 * This function uses the SAP ADT API endpoint to fetch details about an enhancement spot,
 * regardless of whether it has any implementations. It is designed to provide information
 * about the spot's existence, description, type, and status.
 * 
 * @param args - Tool arguments containing:
 *   - enhancement_spot: Name of the enhancement spot (e.g., 'enhoxhh'). This is a required parameter.
 * @returns Response object containing:
 *   - enhancement_spot: The name of the queried enhancement spot.
 *   - metadata: An object with properties like description, type, and status of the enhancement spot.
 *   - raw_xml: The raw XML response from the ADT API for debugging purposes.
 *   - In case of error, an error object with details about the failure.
 */
export async function handleGetEnhancementSpot(args: any) {
    try {
        logger.info('handleGetEnhancementSpot called with args:', args);
        
        if (!args?.enhancement_spot) {
            throw new McpError(ErrorCode.InvalidParams, 'Enhancement spot is required');
        }
        
        const enhancementSpot = args.enhancement_spot;
        
        logger.info(`Getting metadata for enhancement spot: ${enhancementSpot}`);
        
        // Build the ADT URL for the specific enhancement spot (Eclipse uses /sap/bc/adt/enhancements/enhsxsb/{spot_name})
        const url = `${await getBaseUrl()}/sap/bc/adt/enhancements/enhsxsb/${encodeSapObjectName(enhancementSpot)}`;
        
        logger.info(`Enhancement spot URL: ${url}`);
        
        const response = await makeAdtRequestWithTimeout(url, 'GET', 'default', {
            'Accept': 'application/vnd.sap.adt.enhancements.v1+xml'
        });
        
        if (response.status === 200 && response.data) {
            // Parse the XML to extract metadata
            const metadata = parseEnhancementSpotMetadata(response.data);
            
            const enhancementSpotResponse: EnhancementSpotResponse = {
                enhancement_spot: enhancementSpot,
                metadata: metadata,
                raw_xml: response.data // Include raw XML for debugging if needed
            };
            
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(enhancementSpotResponse, null, 2)
                    }
                ]
            };
        } else {
            throw new McpError(
                ErrorCode.InternalError, 
                `Failed to retrieve metadata for enhancement spot ${enhancementSpot}. Status: ${response.status}`
            );
        }
        
    } catch (error) {
        return return_error(error);
    }
}
