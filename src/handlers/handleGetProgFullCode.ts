/**
 * handleGetProgFullCode: retrieves full code for programs (reports) and function groups together with all includes.
 *
 * Description for MCP server:
 * Name: Get full code for program or function group
 * Description: Returns the full code for a given ABAP program (report) or function group, including all includes. Suitable for export, analysis, migration, code audit. The main object (report or function group) always comes first in the response, followed by all child includes in tree traversal order.
 * Parameters:
 * - parent_name: technical name of the program (e.g., /CBY/MMSKLCARD) or function group
 * - parent_tech_name: technical name (usually same as parent_name)
 * - parent_type: 'PROG/P' for program or 'FUGR' for function group
 * - with_short_descriptions: whether to return short descriptions (true/false, optional)
 * Returns: array of objects with code (OBJECT_TYPE, OBJECT_NAME, TECH_NAME, OBJECT_URI, code)
 * Purpose: mass code export, audit, dependency analysis, migration, backup.
 */

import { handleGetProgram } from './handleGetProgram';
import { handleGetFunctionGroup } from './handleGetFunctionGroup';
import { handleGetInclude } from './handleGetInclude';

/**
 * handleGetProgFullCode: returns full code for program (report) or function group with all includes.
 * @param args { name: string, type: "PROG/P" | "FUGR" }
 */
export async function handleGetProgFullCode(args: { name: string; type: "PROG/P" | "FUGR" }) {
  const { name, type } = args;

  // Helper to recursively collect includes for a program/include
  async function collectIncludes(objectName: string, collected: Set<string> = new Set()): Promise<string[]> {
    if (collected.has(objectName)) return [];
    collected.add(objectName);

    // Try to get include source
    const includeResult = await handleGetInclude({ include_name: objectName });
    let code = null;
    if (Array.isArray(includeResult?.content) && includeResult.content.length > 0) {
      const c = includeResult.content[0];
      if (c.type === 'text' && 'text' in c) code = c.text;
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
    if (type === 'PROG/P') {
      // Get main program code
      const progResult = await handleGetProgram({ program_name: name });
      let progCode: string | null = null;
      let debug = { handleGetProgram: progResult };
      if (Array.isArray(progResult?.content) && progResult.content.length > 0) {
        const c = progResult.content[0];
        if (c.type === 'text' && 'text' in c) progCode = c.text as string;
      }
      if (!progCode || (typeof progCode !== 'string') || (progCode && progCode.trim() === '')) {
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
      const includes: string[] = [];
      if (typeof progCode === 'string') {
        let match;
        while ((match = includeRegex.exec(progCode)) !== null) {
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
            let incCode = null;
            if (Array.isArray(incResult?.content) && incResult.content.length > 0) {
              const c = incResult.content[0];
              if (c.type === 'text' && 'text' in c) incCode = c.text;
            }
            codeObjects.push({
              OBJECT_TYPE: 'PROG/I',
              OBJECT_NAME: incName,
              code: incCode,
            });
          }
        }
      }
    } else if (type === 'FUGR') {
      // Get function group main code
      const fgResult = await handleGetFunctionGroup({ function_group: name });
      let fgCode = null;
      if (Array.isArray(fgResult?.content) && fgResult.content.length > 0) {
        const c = fgResult.content[0];
        if (c.type === 'text' && 'text' in c) fgCode = c.text;
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
            let incCode = null;
            if (Array.isArray(incResult?.content) && incResult.content.length > 0) {
              const c = incResult.content[0];
              if (c.type === 'text' && 'text' in c) incCode = c.text;
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
      return { isError: true, content: [{ type: 'text', text: 'Unsupported type' }] };
    }

    const fullResult = {
      name,
      type,
      total_code_objects: codeObjects.length,
      code_objects: codeObjects,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(fullResult, null, 2),
        },
      ],
    };
  } catch (e) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: e instanceof Error ? e.message : String(e),
        },
      ],
    };
  }
}
