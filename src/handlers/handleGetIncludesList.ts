import { McpError, ErrorCode, AxiosResponse } from '../lib/utils';
import { makeAdtRequest, return_error, return_response, getBaseUrl } from '../lib/utils';

async function fetchSource(name: string, type: 'program' | 'include'): Promise<string | null> {
    const baseUrl = await getBaseUrl();
    let url: string;
    // ABAP object names are case-insensitive but typically stored and queried in uppercase.
    const upperName = name.toUpperCase();

    if (type === 'program') {
        url = `${baseUrl}/sap/bc/adt/programs/programs/${upperName}/source/main`;
    } else { // 'include'
        url = `${baseUrl}/sap/bc/adt/programs/includes/${upperName}/source/main`;
    }

    try {
        // Request plain text source code. ADT /source/main endpoint usually provides this.
        // Added 'Content-Type': 'application/octet-stream' as ADT sometimes expects it.
        const response = await makeAdtRequest(url, 'GET', 30000, undefined, { 'Accept': 'text/plain', 'Content-Type': 'application/octet-stream' });

        if (response && response.data && typeof response.data === 'string') {
            return response.data;
        }
        // Fallback if data is not a string but can be converted (e.g. Buffer from Axios)
        if (response && response.data) {
            return String(response.data);
        }
        console.warn(`No data received for ${type} ${upperName} from ${url}`);
        return null;
    } catch (error: any) {
        if (error.isAxiosError && error.response && error.response.status === 404) {
            // This is an expected case if an include is mentioned but doesn't exist, or initial object not found.
            // console.debug(`Source not found (404) for ${type} ${upperName} at ${url}`);
        } else {
            // Log other errors but allow the process to continue for other branches if possible.
            console.warn(`Failed to fetch source for ${type} ${upperName} from ${url}: ${error.message}`);
        }
        return null;
    }
}

function parseIncludes(sourceCode: string): string[] {
    // Regex для знаходження "INCLUDE <name>." statements.
    // Обробляє включення з різними форматами імен (альфа-цифрові, підкреслення, у < > або ' ')
    // Обробляє коментарі (що починаються з " або *) в кінці рядка
    const includePattern = /^\s*INCLUDE\s+([A-Z0-9_<>']+)\s*\.\s*(?:\"|\*.*)?$/gim;
    const includes: string[] = [];
    let match;
    while ((match = includePattern.exec(sourceCode)) !== null) {
        let includeName = match[1];
        // Нормалізація імені включення: видалення <, >, ' символів та перетворення у верхній регістр
        includeName = includeName.replace(/[<>']/g, '').toUpperCase();
        includes.push(includeName);
    }
    return includes;
}

async function findIncludesRecursive(
    objectName: string,
    objectType: 'program' | 'include',
    allFoundIncludes: Set<string>, // Accumulates all unique include names found
    visited: Set<string>          // Tracks "type:NAME" to prevent reprocessing and cycles
): Promise<void> {
    const upperObjectName = objectName.toUpperCase();
    const visitedKey = `${objectType}:${upperObjectName}`;

    if (visited.has(visitedKey)) {
        return; // Already processed or in a processing cycle
    }
    visited.add(visitedKey);

    const sourceCode = await fetchSource(upperObjectName, objectType);
    if (!sourceCode) {
        // If source couldn't be fetched (e.g., 404 or other error), stop recursion for this path.
        return;
    }

    const directIncludes = parseIncludes(sourceCode);
    for (const includeName of directIncludes) {
        // Add to the global list of found includes. Set handles uniqueness.
        allFoundIncludes.add(includeName);
        // Recursively find includes within this newly found include.
        // All subsequent includes are of type 'include'.
        await findIncludesRecursive(includeName, 'include', allFoundIncludes, visited);
    }
}

export async function handleGetIncludesList(args: any) {
    try {
        const { object_name, object_type } = args;

        if (!object_name || typeof object_name !== 'string' || object_name.trim() === '') {
            throw new McpError(ErrorCode.InvalidParams, 'Parameter "object_name" (string) is required and cannot be empty.');
        }
        if (!object_type || (object_type !== 'program' && object_type !== 'include')) {
            throw new McpError(ErrorCode.InvalidParams, 'Parameter "object_type" must be either "program" or "include".');
        }

        const allFoundIncludes = new Set<string>();
        const visited = new Set<string>(); // To handle cyclic dependencies and avoid redundant fetches

        // Запуск рекурсивного пошуку включень
        await findIncludesRecursive(object_name, object_type, allFoundIncludes, visited);

        // Створюємо псевдо-response об'єкт для сумісності з return_response
        const includesList = Array.from(allFoundIncludes);
        const responseData = includesList.length > 0 
            ? `Found ${includesList.length} includes in ${object_type} '${object_name}':\n${includesList.join('\n')}`
            : `No includes found in ${object_type} '${object_name}'.`;
        
        const mockResponse = {
            data: responseData,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {}
        } as any;

        return return_response(mockResponse);

    } catch (error) {
        // Catches McpError and other exceptions, then formats them using return_error.
        return return_error(error);
    }
}
