/**
 * handleGetProgFullCode: returns full code for program (report) or function group with all includes.
 *
 * Description for MCP server:
 * Name: Get full code for program or function group
 * Description: Returns the full code for a given ABAP program (report) or function group, including all includes. The main object (report or function group) always comes first in the response, followed by all child includes in tree traversal order.
 *
 * Parameters:
 * - name: technical name of the program or function group (string, e.g., "/CBY/MM_INVENTORY") — required
 * - type: "PROG/P" for program or "FUGR" for function group (string, required)
 *
 * Returns: JSON:
 *   {
 *     name: string, // technical name of the main object
 *     type: string, // "PROG/P" or "FUGR"
 *     total_code_objects: number, // total number of code objects (main + all includes)
 *     code_objects: [
 *       {
 *         OBJECT_TYPE: string, // "PROG/P" (main program), "FUGR" (function group), or "PROG/I" (include)
 *         OBJECT_NAME: string, // technical name of the object
 *         code: string         // full ABAP source code of the object (entire code, not a fragment)
 *       }
 *     ]
 *   }
 *
 * Notes:
 * - The "code" field always contains the full source code for each object (not truncated).
 * - All includes are resolved recursively and added after the main object.
 * - The order is: main object first, then all includes in tree traversal order.
 * - If the object or code is not found, an error is returned.
 *
 * Purpose: mass code export, audit, dependency analysis, migration, backup.
 */

import { handleGetProgram } from './handleGetProgram';
import { handleGetFunctionGroup } from './handleGetFunctionGroup';
import { handleGetInclude } from './handleGetInclude';

/**
 * handleGetProgFullCode: returns full code for program (report) or function group with all includes.
 * @param args { name: string, type: "PROG/P" | "FUGR" }
 */
export async function handleGetProgFullCode(args: { name: string; type: string }) {
  const { name, type } = args;
  const typeUpper = type.toUpperCase();

  // Helper to recursively collect includes for a program/include
  async function collectIncludes(objectName: string, collected: Set<string> = new Set()): Promise<string[]> {
    if (collected.has(objectName)) return [];
    collected.add(objectName);

    // Try to get include source
    const includeResult = await handleGetInclude({ include_name: objectName });
    let code: string | null = null;
    if (Array.isArray(includeResult?.content) && includeResult.content.length > 0) {
      const c = includeResult.content[0];
      if (c.type === 'text' && 'data' in c) code = c.data as string;
    }

    // Find nested includes in code (ABAP: INCLUDE <name>. or 'INCLUDE <name> .')
    const includeRegex = /^\s*INCLUDE\s+([A-Z0-9_\/]+)\s*\.\s*$/gim;
    const nested: string[] = [];
    if (typeof code === 'string') {
      let match;
      while ((match = includeRegex.exec(code)) !== null) {
        nested.push(match[1]);
      }
    }

    // Recursively collect all nested includes
    let allNested: string[] = [];
    for (const inc of nested) {
      allNested = allNested.concat(await collectIncludes(inc, collected));
    }

    return [objectName, ...allNested];
  }

  try {
    let codeObjects: any[] = [];
    if (typeUpper === 'PROG/P') {
      // Get main program code
      const progResult = await handleGetProgram({ program_name: name });
      let progCode: string | null = null;
      let debug = { handleGetProgram: progResult };
      if (Array.isArray(progResult?.content) && progResult.content.length > 0) {
        const c = progResult.content[0];
        if (c.type === 'text' && 'text' in c) progCode = c.text as string;
      }
      if (typeof progCode !== 'string') {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `No program code found for ${name}. Debug: ${JSON.stringify(debug, null, 2)}`
            }
          ]
        };
      }
      codeObjects.push({
        OBJECT_TYPE: 'PROG/P',
        OBJECT_NAME: name,
        code: progCode,
      });

      // Find all includes in program code
      const includeRegex = /^\s*INCLUDE\s+([A-Z0-9_\/]+)\s*\.\s*$/gim;
      const includeListRegex = /^\s*INCLUDE:\s*([A-Z0-9_\/,\s]+)\./gim;
      const includes: string[] = [];
      if (typeof progCode === 'string') {
        let match;
        // Match single INCLUDE <name>.
        while ((match = includeRegex.exec(progCode)) !== null) {
          includes.push(match[1]);
        }
        // Match INCLUDE: <name1>, <name2>, ... .
        let listMatch;
        while ((listMatch = includeListRegex.exec(progCode)) !== null) {
          const list = listMatch[1]
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          includes.push(...list);
        }
      }

      // Recursively collect all includes (with deduplication)
      const collected = new Set<string>();
      for (const inc of includes) {
        const all = await collectIncludes(inc, collected);
        for (const incName of all) {
          if (!codeObjects.some(obj => obj.OBJECT_TYPE === 'PROG/I' && obj.OBJECT_NAME === incName)) {
            // Get code for each include
            const incResult = await handleGetInclude({ include_name: incName });
            let incCode: string | null = null;
            if (Array.isArray(incResult?.content) && incResult.content.length > 0) {
              const c = incResult.content[0];
              if (c.type === 'text' && 'text' in c) incCode = c.text as string;
            }
            codeObjects.push({
              OBJECT_TYPE: 'PROG/I',
              OBJECT_NAME: incName,
              code: incCode,
            });
          }
        }
      }
    } else if (typeUpper === 'FUGR') {
      // Get function group main code
      const fgResult = await handleGetFunctionGroup({ function_group: name });
      let fgCode: string | null = null;
      if (Array.isArray(fgResult?.content) && fgResult.content.length > 0) {
        const c = fgResult.content[0];
        if (c.type === 'text' && 'text' in c) fgCode = c.text as string;
      }
      codeObjects.push({
        OBJECT_TYPE: 'FUGR',
        OBJECT_NAME: name,
        code: fgCode,
      });

      // Find all includes in function group code
      const includeRegex = /^\s*INCLUDE\s+([A-Z0-9_\/]+)\s*\.\s*$/gim;
      const includes: string[] = [];
      if (typeof fgCode === 'string') {
        let match;
        while ((match = includeRegex.exec(fgCode)) !== null) {
          includes.push(match[1]);
        }
      }

      // Recursively collect all includes (with deduplication)
      const collected = new Set<string>();
      for (const inc of includes) {
        const all = await collectIncludes(inc, collected);
        for (const incName of all) {
          if (!codeObjects.some(obj => obj.OBJECT_TYPE === 'PROG/I' && obj.OBJECT_NAME === incName)) {
            // Get code for each include
            const incResult = await handleGetInclude({ include_name: incName });
            let incCode: string | null = null;
            if (Array.isArray(incResult?.content) && incResult.content.length > 0) {
              const c = incResult.content[0];
              if (c.type === 'text' && 'data' in c) incCode = c.data as string;
            }
            codeObjects.push({
              OBJECT_TYPE: 'PROG/I',
              OBJECT_NAME: incName,
              code: incCode,
            });
          }
        }
      }
    } else {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Unsupported type'
          }
        ]
      };
    }

    // Normalize spaces in code fields: replace 2+ spaces with 1
    codeObjects = codeObjects.map(obj => ({
      ...obj,
      code: typeof obj.code === 'string' ? obj.code.replace(/ {2,}/g, ' ') : obj.code,
    }));

    const fullResult = {
      name,
      type,
      total_code_objects: codeObjects.length,
      code_objects: codeObjects,
    };

    return {
      isError: false,
      content: [
        {
          type: 'text',
          text: JSON.stringify(fullResult, null, 2)
        }
      ]
    };
  } catch (e) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: e instanceof Error ? e.message : String(e)
        }
      ]
    };
  }
}
