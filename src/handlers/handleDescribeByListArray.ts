export const TOOL_DEFINITION = {
  name: "DescribeByListArray",
  description: "Batch description by array payload.",
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
  return await handleSearchObject({ objects: args.objects });
}
