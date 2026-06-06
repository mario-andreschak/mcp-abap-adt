import { McpError, ErrorCode } from '../lib/utils';
import { getBaseUrl, return_error } from '../lib/utils';
import { withWriteAccess, putSource } from '../lib/adtEdit';

/**
 * Write a classical ABAP report's (PROG/P) source main.
 *
 * Args:
 *   program_name              — e.g. "/SKYVVA/TEST_INTERFACE" or "Z_ALV_TEST_01"
 *   source                    — full new source text (UTF-8, line endings normalized to LF)
 *   transport_request_number  — optional; only required for non-$TMP objects not yet
 *                               recorded in any open TR for this user. If the object is
 *                               already part of an open TR you have, omit this.
 *
 * Returns: brief success line. Use mcp__sap-adt-official__abap_activate_objects to compile.
 */
export async function handleSetProgram(args: any) {
    try {
        if (!args?.program_name || typeof args.program_name !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'program_name is required (string)');
        }
        if (typeof args?.source !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'source is required (string)');
        }

        const encoded = encodeURIComponent(args.program_name);
        const objectBase = `${await getBaseUrl()}/sap/bc/adt/programs/programs/${encoded}`;
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
                    `Program ${args.program_name} source updated successfully. ` +
                    `Activate with mcp__sap-adt-official__abap_activate_objects (uri = ` +
                    `'/sap/bc/adt/programs/programs/${encoded}/source/main') to compile.`,
            }],
        };
    } catch (error) {
        return return_error(error);
    }
}
