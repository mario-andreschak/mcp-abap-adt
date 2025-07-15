export const TOOL_DEFINITION = {
  name: "DescribeByListArray",
  description: "Batch description by array payload. Each object may be of type: PROG/P (program), FUGR (function group), PROG/I (include), CLAS/OC (class), FUGR/FC (function), INTF/OI (interface), TABLE, STRUCTURE, etc.",
  inputSchema: {
    type: "object",
    properties: {
      objects: {
        type: "array",
        description: "Array of objects with name and optional type. Each item: { name: string, type?: string }",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Object name (required)" },
            type: { type: "string", description: "Optional type" }
          },
          required: ["name"]
        }
      }
    },
    required: ["objects"]
  }
} as const;

// DescribeByListArray: Batch description by array

import { handleSearchObject } from "./handleSearchObject";

/**
 * DescribeByListArray handler.
 * @param args { objects: Array<{ name: string, type?: string }> }
 * @returns Result of handleDetectObjectTypeList with objects
 */
export async function handleDescribeByListArray(args: any) {
  if (!Array.isArray(args.objects)) {
    throw new Error("Parameter 'objects' must be an array.");
  }
  // Normalize type: if type exists and does not contain '/', add '/*'
  const normalizedObjects = args.objects.map(obj => {
    if (obj.type && typeof obj.type === "string" && !obj.type.includes("/")) {
      return { ...obj, type: `${obj.type}/*` };
    }
    return obj;
  });
  return await handleSearchObject({ objects: normalizedObjects });
}
