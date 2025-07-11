import { handleDetectObjectType } from './handleDetectObjectType';
import { McpError, ErrorCode } from '../lib/utils';
import { handleGetDescription } from './handleGetDescription';

/**
 * Batch detection of ABAP object types.
 * Accepts:
 *   - Array of objects: [{ name: string, type?: string }]
 *   - Object with array property (e.g. { global: [...] }) containing such objects
 * Returns: array of detected objects with type and metadata.
 */
export async function handleDetectObjectTypeList(args: any) {
    // DEBUG: log input for troubleshooting
    // eslint-disable-next-line no-console
    console.log('[handleDetectObjectTypeList] args:', JSON.stringify(args));

    // Accepts: { global: [...] } or { list: [...] }
    let items: any[] | undefined = undefined;
    if (args?.global && Array.isArray(args.global)) {
        items = args.global;
    } else if (args?.list && Array.isArray(args.list)) {
        items = args.list;
    }

    // Якщо жоден не вказано — помилка формату MCP
    if (!items) {
        throw new McpError(ErrorCode.InvalidParams, 'MCP error: Input must contain at least one of the following array properties: "global" або "list"');
    }

    const results: any[] = [];

    for (const item of items) {
        if (!item?.name) continue;

        // Detect object type
        const detectResult = await handleDetectObjectType({ name: item.name });
        // Runtime check: must be object with isError/content
        if (
            !detectResult ||
            typeof detectResult !== 'object' ||
            !('isError' in detectResult) ||
            !('content' in detectResult) ||
            detectResult.isError ||
            !Array.isArray(detectResult.content) ||
            detectResult.content.length === 0
        ) continue;

        for (const detected of detectResult.content) {
            if (!detected?.objectType || !detected?.objectName) continue;
            results.push({
                name: detected.objectName,
                detectedType: detected.objectType,
                description: detected.description || '',
                shortText: detected.shortText || '',
                longText: detected.longText || '',
                text: detected.text || '',
                package: detected.packageName || '',
                uri: detected.uri || ''
            });
        }
    }

    return {
        isError: false,
        content: results
    };
}
