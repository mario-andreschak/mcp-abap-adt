export const TOOL_DEFINITION = {
  name: "DescribeByList",
  description: "Batch description for a list of ABAP objects. Input: objects: Array<{ name: string, type?: string }>. Each object may be of type: PROG/P, FUGR, PROG/I, CLAS/OC, FUGR/FC, INTF/OI, TABLE, STRUCTURE, etc.",
  inputSchema: {
    type: "object",
    properties: {
      objects: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Object name (required, must be valid ABAP object name or mask)" },
            type: { type: "string", description: "Optional type (e.g. PROG/P, CLAS/OC, etc.)" }
          }
        }
      }
    },
    required: ["objects"]
  }
} as const;

// DescribeByList: Batch description for a list of ABAP objects

import { handleSearchObject } from "./handleSearchObject";

/**
 * DescribeByListArray handler.
 * @param args { objects: Array<{ name: string, type?: string }> }
 * @returns Result of handleDetectObjectTypeList with objects
 */
export async function handleDescribeByList(args: any) {
  const objects = args.objects;
  if (!Array.isArray(objects)) {
    throw new Error("Parameter 'objects' must be an array.");
  }
  const results: any[] = [];
  for (const obj of objects) {
    let type = obj.type;
    if (type && typeof type === "string" && !type.includes("/")) {
      type = `${type}/*`;
    }
    const res = await handleSearchObject({ object_name: obj.name, object_type: type });
    results.push(res);
  }
  return { content: results };
}
