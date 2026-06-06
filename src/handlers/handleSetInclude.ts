import { McpError, ErrorCode } from '../lib/utils';
import { getBaseUrl, return_error } from '../lib/utils';
import { withWriteAccess, putSource } from '../lib/adtEdit';

/**
 * Write an ABAP include's (PROG/I) source main.
 *
 * Args:
 *   include_name              — name of the include (e.g. "/SKYVVA/CL_FOO_BAR_DEFINITIONS")
 *   source                    — full new source text
 *   transport_request_number  — optional TR
 *
 * Returns: success line + activation hint.
 */
export async function handleSetInclude(args: any) {
    try {
        if (!args?.include_name || typeof args.include_name !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'include_name is required (string)');
        }
        if (typeof args?.source !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'source is required (string)');
        }

        const encoded = encodeURIComponent(args.include_name);
        const objectBase = `${await getBaseUrl()}/sap/bc/adt/programs/includes/${encoded}`;
        const sourceUri = `${objectBase}/source/main`;

        await withWriteAccess(objectBase, (lockHandle) =>
            putSource(sourceUri, lockHandle, args.source, {
                transportRequestNumber: args.transport_request_number,
            })
        );

        return {
            isError: false,
            content: [{
                type: 'text',
                text:
                    `Include ${args.include_name} source updated successfully. ` +
                    `Activate with mcp__sap-adt-official__abap_activate_objects (uri = ` +
                    `'/sap/bc/adt/programs/includes/${encoded}/source/main') to compile.`,
            }],
        };
    } catch (error) {
        return return_error(error);
    }
}
