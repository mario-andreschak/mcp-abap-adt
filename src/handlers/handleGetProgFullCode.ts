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

import { handleGetObjectsList } from './handleGetObjectsList';
import { handleGetProgram } from './handleGetProgram';
import { handleGetFunctionGroup } from './handleGetFunctionGroup';
import { handleGetInclude } from './handleGetInclude';

type ObjectEntry = {
  OBJECT_TYPE: string;
  OBJECT_NAME: string;
  TECH_NAME: string;
  OBJECT_URI: string;
};

const HANDLER_MAP: Record<string, (args: any) => Promise<any>> = {
  // Programs (reports)
  'PROG/P': async (obj) => handleGetProgram({ program_name: obj.OBJECT_NAME }),
  // Includes
  'PROG/I': async (obj) => handleGetInclude({ include_name: obj.OBJECT_NAME }),
  // Function groups
  'FUGR': async (obj) => handleGetFunctionGroup({ function_group: obj.OBJECT_NAME }),
};

import { objectsListCache } from '../lib/getObjectsListCache';

export async function handleGetProgFullCode(args: any) {
  const { parent_name, parent_tech_name, parent_type, with_short_descriptions } = args;
  const objectsListResult = await handleGetObjectsList({
    parent_name,
    parent_tech_name,
    parent_type,
    with_short_descriptions,
  });

  if (!objectsListResult || !objectsListResult.content || !Array.isArray(objectsListResult.content)) {
    return { isError: true, content: [{ type: 'text', text: 'GetObjectsList failed' }] };
  }

  const jsonBlock = objectsListResult.content.find(
    (x: any) =>
      x &&
      x.type === 'json' &&
      typeof x.json === 'object' &&
      x.json &&
      Array.isArray(x.json.objects)
  );
  if (!jsonBlock) {
    return { isError: true, content: [{ type: 'text', text: 'No objects found' }] };
  }

  // Safely extract objects array and ensure correct structure
  const objectsRaw = (jsonBlock as any).json?.objects ?? [];
  const objects: ObjectEntry[] = Array.isArray(objectsRaw)
    ? objectsRaw
        .map((obj: any) => {
          // If object is { type: 'json', json: {...} }
          if (obj && obj.type === 'json' && typeof obj.json === 'object') {
            return {
              OBJECT_TYPE: obj.json.OBJECT_TYPE ?? obj.json.object_type ?? '',
              OBJECT_NAME: obj.json.OBJECT_NAME ?? obj.json.object_name ?? '',
              TECH_NAME: obj.json.TECH_NAME ?? obj.json.tech_name ?? '',
              OBJECT_URI: obj.json.OBJECT_URI ?? obj.json.object_uri ?? '',
            };
          }
          // If object is plain object with fields
          return {
            OBJECT_TYPE: obj.OBJECT_TYPE ?? obj.object_type ?? '',
            OBJECT_NAME: obj.OBJECT_NAME ?? obj.object_name ?? '',
            TECH_NAME: obj.TECH_NAME ?? obj.tech_name ?? '',
            OBJECT_URI: obj.OBJECT_URI ?? obj.object_uri ?? '',
          };
        })
        .filter((o: ObjectEntry) => o.OBJECT_TYPE && o.OBJECT_NAME)
    : [];
  let rootCodeObj: any = null;

  if (parent_type === 'PROG/P') {
    try {
      const codeResult = await handleGetProgram({ program_name: parent_name });
      let code: any = null;
      if (Array.isArray(codeResult?.content) && codeResult.content.length > 0) {
        const c = codeResult.content[0];
        if (c.type === 'text' && 'text' in c) code = c.text;
        else if (c.type === 'json' && 'json' in c) code = c.json;
      }
      rootCodeObj = {
        OBJECT_TYPE: parent_type,
        OBJECT_NAME: parent_name,
        TECH_NAME: parent_tech_name,
        OBJECT_URI: '',
        code,
      };
    } catch (e) {
      rootCodeObj = {
        OBJECT_TYPE: parent_type,
        OBJECT_NAME: parent_name,
        TECH_NAME: parent_tech_name,
        OBJECT_URI: '',
        code: null,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  } else if (parent_type === 'FUGR') {
    try {
      const codeResult = await handleGetFunctionGroup({ function_group: parent_name });
      let code: any = null;
      if (Array.isArray(codeResult?.content) && codeResult.content.length > 0) {
        const c = codeResult.content[0];
        if (c.type === 'text' && 'text' in c) code = c.text;
        else if (c.type === 'json' && 'json' in c) code = c.json;
      }
      rootCodeObj = {
        OBJECT_TYPE: parent_type,
        OBJECT_NAME: parent_name,
        TECH_NAME: parent_tech_name,
        OBJECT_URI: '',
        code,
      };
    } catch (e) {
      rootCodeObj = {
        OBJECT_TYPE: parent_type,
        OBJECT_NAME: parent_name,
        TECH_NAME: parent_tech_name,
        OBJECT_URI: '',
        code: null,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  // Add rootCodeObj first, then all others (without duplication)
  const codeObjects: any[] = [];
  if (rootCodeObj) codeObjects.push(rootCodeObj);

  for (const obj of objects) {
    // Skip duplicate root object (to avoid two PROG/P or FUGR with the same name)
    if (
      rootCodeObj &&
      obj.OBJECT_TYPE === parent_type &&
      obj.OBJECT_NAME === parent_name
    ) {
      continue;
    }
    const handler = HANDLER_MAP[obj.OBJECT_TYPE];
    if (handler) {
      try {
        const codeResult = await handler(obj);
        let code = null;
        if (Array.isArray(codeResult?.content) && codeResult.content.length > 0) {
          const c = codeResult.content[0];
          if (c && typeof c === 'object' && 'type' in c) {
            if (c.type === 'text' && 'text' in c) code = c.text;
            else if (c.type === 'json' && 'json' in c) code = c.json;
          }
        }
        codeObjects.push({
          ...obj,
          code,
        });
      } catch (e) {
        codeObjects.push({
          ...obj,
          code: null,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  const fullResult = {
    parent_name,
    parent_tech_name,
    parent_type,
    total_code_objects: codeObjects.length,
    code_objects: codeObjects,
  };

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify(fullResult, null, 2),
      },
    ],
  };
  objectsListCache.setCache(result);
  return result;
}
