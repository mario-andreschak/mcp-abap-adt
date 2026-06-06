import { McpError, ErrorCode } from '../lib/utils';
import { makeAdtRequest, getBaseUrl, return_error } from '../lib/utils';
import { lockObject, unlockObject } from '../lib/adtEdit';

/**
 * Map an object type/name pair to its ADT base URI.
 * Extend as needed for additional types.
 */
function resolveObjectBase(objectType: string, name: string, baseUrl: string): string {
    const enc = encodeURIComponent(name);
    const t = objectType.toUpperCase();
    switch (t) {
        case 'CLAS':
        case 'CLAS/OC':
        case 'CLASS':
            return `${baseUrl}/sap/bc/adt/oo/classes/${enc}`;
        case 'INTF':
        case 'INTF/OI':
        case 'INTERFACE':
            return `${baseUrl}/sap/bc/adt/oo/interfaces/${enc}`;
        case 'PROG':
        case 'PROG/P':
        case 'PROGRAM':
        case 'REPORT':
            return `${baseUrl}/sap/bc/adt/programs/programs/${enc}`;
        case 'PROG/I':
        case 'INCLUDE':
            return `${baseUrl}/sap/bc/adt/programs/includes/${enc}`;
        case 'FUGR':
        case 'FUGR/F':
        case 'FUNCTION_GROUP':
            return `${baseUrl}/sap/bc/adt/functions/groups/${enc}`;
        case 'DDLS':
        case 'DDLS/DF':
            return `${baseUrl}/sap/bc/adt/ddic/ddl/sources/${enc}`;
        default:
            throw new McpError(ErrorCode.InvalidParams,
                `Unsupported objectType: ${objectType}. ` +
                `Supported: CLAS, INTF, PROG (P/I), FUGR, DDLS.`);
    }
}

/**
 * Delete an ABAP repository object via ADT REST. Acquires a DELETE lock,
 * issues HTTP DELETE, then releases (server typically auto-releases on success).
 *
 * Args:
 *   object_type               — 'CLAS' | 'INTF' | 'PROG' | 'PROG/I' (include) | 'FUGR' | 'DDLS'
 *                               (or fully qualified like 'CLAS/OC', 'PROG/P')
 *   object_name               — e.g. 'ZCL_HELLO_SSO_TEST'
 *   transport_request_number? — optional TR
 *
 * Note: this is destructive. The MCP framework should already gate this behind
 * an explicit confirmation prompt to the user.
 */
export async function handleDeleteObject(args: any) {
    try {
        if (!args?.object_type || typeof args.object_type !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'object_type is required (string)');
        }
        if (!args?.object_name || typeof args.object_name !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'object_name is required (string)');
        }

        const baseUrl = String(await getBaseUrl());
        const objectBase = resolveObjectBase(args.object_type, args.object_name, baseUrl);

        // Acquire delete-lock (accessMode=MODIFY is what ADT actually uses for deletes too)
        const lockHandle = await lockObject(objectBase);
        try {
            let deleteUrl = `${objectBase}?lockHandle=${encodeURIComponent(lockHandle)}`;
            if (args.transport_request_number) {
                deleteUrl += `&corrNr=${encodeURIComponent(args.transport_request_number)}`;
            }
            await makeAdtRequest(deleteUrl, 'DELETE', 60000, undefined, undefined, {
                'X-sap-adt-sessiontype': 'stateful',
            });
        } catch (e) {
            // Always try to unlock so we don't leave a stale ENQUEUE lock behind
            await unlockObject(objectBase, lockHandle);
            throw e;
        }

        return {
            isError: false,
            content: [{
                type: 'text',
                text: `${args.object_type} ${args.object_name} deleted successfully.`,
            }],
        };
    } catch (error) {
        return return_error(error);
    }
}
