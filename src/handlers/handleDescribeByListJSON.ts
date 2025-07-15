export const TOOL_DEFINITION = {
  name: "DescribeByListJSON",
  description: "Batch description by JSON payload.",
  inputSchema: {
    type: "object",
    properties: {
      payload: {
        type: "object",
        description: "Object with 'objects' property: { objects: [{ name: string, type?: string }] }",
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
    },
    required: ["payload"]
  }
} as const;

// DescribeByListJSON: Batch description by JSON payload

import { handleDescribeByListArray } from "./handleDescribeByListArray";

/**
 * DescribeByListJSON handler.
 * @param args { payload: { objects: Array<{ name: string, type?: string }> } }
 * @returns Result of handleDescribeByListArray with objects from payload
 */
export async function handleDescribeByListJSON(args: any) {
  if (!args.payload || !Array.isArray(args.payload.objects)) {
    throw new Error("Parameter 'payload.objects' must be an array.");
  }
  return await handleDescribeByListArray({ objects: args.payload.objects });
}
