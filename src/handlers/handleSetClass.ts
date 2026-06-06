import { McpError, ErrorCode } from '../lib/utils';
import { getBaseUrl, return_error } from '../lib/utils';
import { withWriteAccess, putSource } from '../lib/adtEdit';

const VALID_PARTS = ['main', 'definitions', 'implementations', 'macros', 'testclasses'] as const;
type Part = typeof VALID_PARTS[number];

/**
 * Write the source of an ABAP class (CLAS/OC). A class has multiple "source parts"
 * in ADT — by default we write `main` which is the full class body (definition +
 * implementation as one source). The other parts (definitions / implementations /
 * macros / testclasses) are separate when the class uses include splits.
 *
 * Args:
 *   class_name                — name of the class (e.g. ZCL_HELLO_SSO_TEST)
 *   source                    — full new source text
 *   part?                     — optional, one of: main | definitions | implementations | macros | testclasses
 *                               default: 'main'
 *   transport_request_number? — optional TR for non-$TMP objects
 */
export async function handleSetClass(args: any) {
    try {
        if (!args?.class_name || typeof args.class_name !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'class_name is required (string)');
        }
        if (typeof args?.source !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'source is required (string)');
        }
        const part: Part = (args.part as Part) || 'main';
        if (!VALID_PARTS.includes(part)) {
            throw new McpError(ErrorCode.InvalidParams,
                `part must be one of: ${VALID_PARTS.join(', ')}`);
        }

        const encoded = encodeURIComponent(args.class_name);
        const objectBase = `${await getBaseUrl()}/sap/bc/adt/oo/classes/${encoded}`;
        // main is the top-level source; other parts live under /includes/<part>/source/main
        const sourceUri = part === 'main'
            ? `${objectBase}/source/main`
            : `${objectBase}/includes/${part}/source/main`;

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
                    `Class ${args.class_name} ${part} source updated successfully. ` +
                    `Activate with mcp__sap-adt-official__abap_activate_objects ` +
                    `(uri = '${sourceUri.substring(sourceUri.indexOf('/sap'))}').`,
            }],
        };
    } catch (error) {
        return return_error(error);
    }
}
