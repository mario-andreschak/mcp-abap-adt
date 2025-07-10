// handleGetObjectsListStrict: рекурсивний обхід ADT node structure, стартує з node_id = '000000' як у прикладі користувача

import { McpError, ErrorCode } from '../lib/utils';
import { fetchNodeStructure, return_error } from '../lib/utils';
import { saveObjectsListCache } from '../lib/getObjectsListCache';
import { writeResultToFile } from '../lib/writeResultToFile';

/**
 * Парсить всі SEU_ADT_REPOSITORY_OBJ_NODE з XML, повертає масив об'єктів з потрібними полями
 */
function parseValidObjects(xmlData: string): Array<Record<string, string>> {
    const nodes: Array<Record<string, string>> = [];
    try {
        const nodeRegex = /<SEU_ADT_REPOSITORY_OBJ_NODE>([\s\S]*?)<\/SEU_ADT_REPOSITORY_OBJ_NODE>/g;
        let match;
        while ((match = nodeRegex.exec(xmlData)) !== null) {
            const nodeXml = match[1];
            const obj: Record<string, string> = {};
            // Витягуємо потрібні поля
            const typeMatch = nodeXml.match(/<OBJECT_TYPE>([^<]+)<\/OBJECT_TYPE>/);
            const nameMatch = nodeXml.match(/<OBJECT_NAME>([^<]+)<\/OBJECT_NAME>/);
            const techNameMatch = nodeXml.match(/<TECH_NAME>([^<]+)<\/TECH_NAME>/);
            const uriMatch = nodeXml.match(/<OBJECT_URI>([^<]+)<\/OBJECT_URI>/);
            if (typeMatch && nameMatch && techNameMatch && uriMatch) {
                obj.OBJECT_TYPE = typeMatch[1];
                obj.OBJECT_NAME = nameMatch[1];
                obj.TECH_NAME = techNameMatch[1];
                obj.OBJECT_URI = uriMatch[1];
                nodes.push(obj);
            }
        }
    } catch (error) {
        console.warn('Error parsing XML for valid objects:', error);
    }
    return nodes;
}

/**
 * Парсить всі NODE_ID з OBJECT_TYPES з XML
 */
function parseNodeIds(xmlData: string): string[] {
    const nodeIds: string[] = [];
    try {
        const typeRegex = /<SEU_ADT_OBJECT_TYPE_INFO>([\s\S]*?)<\/SEU_ADT_OBJECT_TYPE_INFO>/g;
        let match;
        while ((match = typeRegex.exec(xmlData)) !== null) {
            const block = match[1];
            const nodeIdMatch = block.match(/<NODE_ID>([^<]+)<\/NODE_ID>/);
            if (nodeIdMatch) {
                nodeIds.push(nodeIdMatch[1]);
            }
        }
    } catch (error) {
        console.warn('Error parsing XML for node ids:', error);
    }
    return nodeIds;
}

/**
 * Рекурсивно обходить вузли ADT node structure, повертає лише валідні об'єкти
 */
async function collectValidObjectsStrict(
    parent_name: string,
    parent_tech_name: string,
    parent_type: string,
    node_id: string,
    with_short_descriptions: boolean,
    visited: Set<string>
): Promise<Array<Record<string, string>>> {
    if (visited.has(node_id)) return [];
    visited.add(node_id);

    const response = await fetchNodeStructure(
        parent_name,
        parent_tech_name,
        parent_type,
        node_id,
        with_short_descriptions
    );
    const xml = response.data;

    // Додаємо лише валідні об'єкти
    const objects = parseValidObjects(xml);

    // Рекурсивно обходимо дочірні вузли по NODE_ID
    const nodeIds = parseNodeIds(xml);
    for (const childNodeId of nodeIds) {
        const childObjects = await collectValidObjectsStrict(
            parent_name,
            parent_tech_name,
            parent_type,
            childNodeId,
            with_short_descriptions,
            visited
        );
        objects.push(...childObjects);
    }

    return objects;
}

/**
 * Головний handler для GetObjectsListStrict
 * @param args { parent_name, parent_tech_name, parent_type, with_short_descriptions, filePath }
 */
export async function handleGetObjectsList(args: any) {
    try {
        const { parent_name, parent_tech_name, parent_type, with_short_descriptions, filePath } = args;

        if (!parent_name || typeof parent_name !== 'string' || parent_name.trim() === '') {
            throw new McpError(ErrorCode.InvalidParams, 'Parameter "parent_name" (string) is required and cannot be empty.');
        }
        if (!parent_tech_name || typeof parent_tech_name !== 'string' || parent_tech_name.trim() === '') {
            throw new McpError(ErrorCode.InvalidParams, 'Parameter "parent_tech_name" (string) is required and cannot be empty.');
        }
        if (!parent_type || typeof parent_type !== 'string' || parent_type.trim() === '') {
            throw new McpError(ErrorCode.InvalidParams, 'Parameter "parent_type" (string) is required and cannot be empty.');
        }

        const withDescriptions = with_short_descriptions !== undefined ? Boolean(with_short_descriptions) : true;

        // Стартуємо з node_id = '000000' (кореневий вузол)
        const objects = await collectValidObjectsStrict(
            parent_name.toUpperCase(),
            parent_tech_name.toUpperCase(),
            parent_type,
            '000000',
            withDescriptions,
            new Set()
        );

        // Повертаємо результат у вигляді JSON
        const result = {
            parent_name,
            parent_tech_name,
            parent_type,
            total_objects: objects.length,
            objects
        };

        // Зберігаємо у кеш (тільки в памʼяті)
        (global as any).__getObjectsListCache = result;

        if (filePath) {
            writeResultToFile(result, filePath);
        }

        return {
            content: [
                {
                    type: "json",
                    json: result
                }
            ],
            // Додаємо кеш для можливого використання в інших модулях
            cache: (global as any).__getObjectsListCache
        };
    } catch (error) {
        return return_error(error);
    }
}
