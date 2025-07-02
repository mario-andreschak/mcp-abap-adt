// GetDescription: Strict match ABAP object search by name, returns metadata and description.

import { McpError, ErrorCode, makeAdtRequestWithTimeout, return_error, return_response, getBaseUrl, encodeSapObjectName } from '../lib/utils';

export async function handleGetDescription(args: any) {
  try {
    if (!args?.object_name) {
      throw new McpError(ErrorCode.InvalidParams, 'Parameter "object_name" is required.');
    }
    if (!args?.object_type) {
      throw new McpError(ErrorCode.InvalidParams, 'Parameter "object_type" is required.');
    }
    // Build ADT URI for the object
    function buildAdtUri(objectType: string, objectName: string): string {
      const encodedName = encodeSapObjectName(objectName);
      switch (objectType.toLowerCase()) {
        case "enhancementspot":
        case "enhancement_spot":
        case "enhancement-spot":
        case "enhs":
        case "enho":
          return `/sap/bc/adt/enhancements/enhsxsb/${encodedName}`;
        case "enhancementimpl":
        case "enhancement_impl":
        case "enhancement-impl":
        case "enhi":
          return `/sap/bc/adt/enhancements/enhoxhh/${encodedName}`;
        case "class":
          return `/sap/bc/adt/oo/classes/${encodedName}`;
        case "interface":
          return `/sap/bc/adt/oo/interfaces/${encodedName}`;
        case "program":
          return `/sap/bc/adt/programs/programs/${encodedName}`;
        case "include":
          return `/sap/bc/adt/programs/includes/${encodedName}`;
        case "function":
        case "functiongroup":
          return `/sap/bc/adt/functions/groups/${encodedName}`;
        case "package":
          return `/sap/bc/adt/packages/${encodedName}`;
        case "table":
        case "tabl":
          return `/sap/bc/adt/ddic/tables/${encodedName}`;
        case "bdef":
          return `/sap/bc/adt/bo/behaviordefinitions/${encodedName}`;
        default:
          // Fallback: try generic plural path
          return `/sap/bc/adt/${objectType.toLowerCase()}s/${encodedName}`;
      }
    }
    const baseUrl = await getBaseUrl();
    const adtUri = buildAdtUri(args.object_type, args.object_name);
    const endpoint = `${baseUrl}/sap/bc/adt/repository/informationsystem/objectproperties/values?uri=${encodeURIComponent(adtUri)}&facet=package&facet=appl`;
    const response = await makeAdtRequestWithTimeout(endpoint, 'GET', 'default');
    // Parse XML to JSON
    const xml = response.data;
    const mainObjMatch = xml.match(/<opr:object\s+([^>]+)>/);
    const getAttr = (attrs: string, attr: string) => {
      const m = attrs.match(new RegExp(attr + '="([^"]*)"'));
      return m ? m[1] : undefined;
    };
    let result: Record<string, any> = {};
    if (mainObjMatch) {
      const attrs = mainObjMatch[1];
      result = {
        name: getAttr(attrs, 'name'),
        type: getAttr(attrs, 'type'),
        description: getAttr(attrs, 'text'),
        package: getAttr(attrs, 'package'),
      };
    }
    // Package property
    const pkgMatch = xml.match(/<opr:property[^>]+facet="PACKAGE"[^>]+name="([^"]*)"[^>]+text="([^"]*)"/);
    if (pkgMatch) {
      result.package = pkgMatch[1];
      result.package_text = pkgMatch[2];
    }
    // Application property
    const applMatch = xml.match(/<opr:property[^>]+facet="APPL"[^>]+name="([^"]*)"[^>]+text="([^"]*)"/);
    if (applMatch) {
      result.application = applMatch[1];
      result.application_text = applMatch[2];
    }
    return {
      isError: false,
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return return_error(error);
  }
}
