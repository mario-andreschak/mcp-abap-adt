import { McpError, ErrorCode } from '../lib/utils';
import { getBaseUrl, return_error } from '../lib/utils';
import { withWriteAccess, putSource } from '../lib/adtEdit';

/**
 * Write the source of a function module (FUGR/FF).
 *
 * Args:
 *   function_name             — FM name (e.g. /SKYVVA/MULTI_ITAB_ADAPTER_V3)
 *   function_group            — Function group (e.g. /SKYVVA/ADAPTERS_V2_3)
 *   source                    — full new source text (between FUNCTION ... ENDFUNCTION)
 *   transport_request_number? — optional TR
 *
 * Note: FMs lock at the function-module level, not the group level. The PUT URI
 * is the FM main source. The group itself owns includes (top, main, ...), to write
 * those use SetInclude with the include name (LZ<FG>TOP, L<FG>U01, etc.).
 */
export async function handleSetFunction(args: any) {
    try {
        if (!args?.function_name || typeof args.function_name !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'function_name is required (string)');
        }
        if (!args?.function_group || typeof args.function_group !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'function_group is required (string)');
        }
        if (typeof args?.source !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'source is required (string)');
        }

        const encFm = encodeURIComponent(args.function_name);
        const encFg = encodeURIComponent(args.function_group);
        const objectBase = `${await getBaseUrl()}/sap/bc/adt/functions/groups/${encFg}/fmodules/${encFm}`;
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
                    `Function Module ${args.function_name} (group ${args.function_group}) ` +
                    `source updated successfully. Activate with mcp__sap-adt-official__abap_activate_objects ` +
                    `(uri = '/sap/bc/adt/functions/groups/${encFg}/fmodules/${encFm}/source/main').`,
            }],
        };
    } catch (error) {
        return return_error(error);
    }
}
