import { handleSearchObject } from "./handleDetectObjectType";

/**
 * Batch detection of ABAP object types for a list of names.
 * @param args { objects: [{ name: string }] }
 */
export async function handleDetectObjectTypeList(args: { objects: Array<{ name: string }> }) {
    const { objects } = args;
    if (!Array.isArray(objects) || objects.length === 0) {
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    data: "No objects provided",
                    mimeType: "text/plain"
                }
            ]
        };
    }

    const results: any[] = [];
    for (const obj of objects) {
        const res = await handleSearchObject({ name: obj.name });
        if (Array.isArray(res.content) && res.content.length > 0) {
            // Parse MCP content data as JSON
            let detected: any;
            try {
                detected = JSON.parse(res.content[0].data);
            } catch {
                detected = {};
            }
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
        content: [
            {
                type: "text",
                data: JSON.stringify(results, null, 2),
                mimeType: "application/json"
            }
        ]
    };
}
