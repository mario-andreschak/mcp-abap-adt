import { handleSearchObject } from "./handleDetectObjectType";

/**
 * Batch detection of ABAP object types for a list of names.
 * @param args { objects: [{ name: string }] }
 */
export async function handleDetectObjectTypeList(args: { objects: Array<{ name: string }> }) {
    const { objects } = args;
    if (!Array.isArray(objects) || objects.length === 0) {
        throw new Error("Parameter 'objects' must be a non-empty array.");
    }

    const results: any[] = [];
    for (const obj of objects) {
        console.log(`[DetectObjectTypeList] Searching for:`, obj.name);
        const res = await handleSearchObject({ name: obj.name });
        console.log(`[DetectObjectTypeList] Result for ${obj.name}:`, res);
        if (Array.isArray(res.content) && res.content.length > 0) {
            // Parse MCP content data as JSON
            let detected: any;
            try {
                detected = JSON.parse(res.content[0].text);
            } catch {
                detected = {};
            }
            console.log(`[DetectObjectTypeList] Parsed detected for ${obj.name}:`, detected);
            if (Array.isArray(detected)) {
                for (const item of detected) {
                    if (!item?.objectType || !item?.objectName) continue;
                    console.log(`[DetectObjectTypeList] Adding item for ${obj.name}:`, item);
                    results.push({
                        name: item.objectName,
                        detectedType: item.objectType,
                        description: item.description || '',
                        shortText: item.shortText || '',
                        longText: item.longText || '',
                        text: item.text || '',
                        package: item.packageName || '',
                        uri: item.uri || ''
                    });
                }
            } else if (detected?.objectType && detected?.objectName) {
                console.log(`[DetectObjectTypeList] Adding detected for ${obj.name}:`, detected);
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
        } else {
            console.log(`[DetectObjectTypeList] No content for ${obj.name}:`, res);
        }
    }

    return {
        isError: false,
        content: [
            {
                type: "text",
                text: JSON.stringify(results, null, 2)
            }
        ]
    };
}
