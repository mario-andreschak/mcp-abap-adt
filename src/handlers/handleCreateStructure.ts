// src/handlers/handleCreateStructure.ts
import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

/**
 * IMPORTANT:
 * - ADT "create DDIC structure" can vary by SAP release.
 * - This handler is designed so you can plug in the exact endpoint + payload
 *   you capture from ADT (Eclipse) when creating a structure manually.
 */
export async function handleCreateStructure(args: any) {
  try {
    if (!args?.name) throw new McpError(ErrorCode.InvalidParams, 'Structure name is required');
    if (!args?.package) throw new McpError(ErrorCode.InvalidParams, 'Package is required');
    if (!args?.source) throw new McpError(ErrorCode.InvalidParams, 'source is required (the DDIC structure source payload)');

    const name = String(args.name).toUpperCase();
    const devclass = String(args.package).toUpperCase();
    const transport = args.transport ? String(args.transport).toUpperCase() : undefined;

    // 1) CREATE step (often needed for new objects)
    // NOTE: This endpoint/payload is the *part you may need to adjust* to your system.
    // Capture the exact request ADT sends and mirror it here.
    const createUrl = `${await getBaseUrl()}/sap/bc/adt/ddic/structures`;

    // Common pattern in ADT: Slug header carries the object name (varies!)
    const createHeaders: Record<string, string> = {
      // You will likely need to adjust these content types after capturing ADT traffic
      'Content-Type': 'application/xml',
      'Accept': 'application/xml',
      'Slug': name,
    };

    // Minimal create “descriptor” payload — YOU MAY NEED TO REPLACE with the real ADT XML
    // (package/transport recording is also system-dependent)
    const createBody = args.createDescriptorXml ?? `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/ddic/structures/${name}" adtcore:name="${name}" />
</adtcore:objectReferences>`;

    // Try creating; if it already exists, some systems return 409/4xx — you can ignore if you want.
    try {
      await makeAdtRequest(createUrl, 'POST', 30000, createBody, undefined, createHeaders);
    } catch (e: any) {
      // If structure already exists, we continue to "PUT source" below.
      // You can tighten this check to only ignore specific status codes.
    }

    // 2) PUT the structure source (this is the part you’ll definitely need)
    const encodedName = encodeURIComponent(name);
    const putUrl = `${await getBaseUrl()}/sap/bc/adt/ddic/structures/${encodedName}/source/main`;

    // Use the same format that GET returns from /source/main (often XML)
    const putHeaders: Record<string, string> = {
      'Content-Type': args.contentType ?? 'application/xml',
      'Accept': args.accept ?? 'application/xml',
      ...(transport ? { 'sap-adt-transportrequest': transport } : {}),
      // Sometimes package is in query/descriptor instead; keep it available:
      ...(devclass ? { 'sap-adt-package': devclass } : {}),
    };

    const response = await makeAdtRequest(putUrl, 'PUT', 30000, args.source, undefined, putHeaders);
    return return_response(response);
  } catch (error) {
    return return_error(error);
  }
}
