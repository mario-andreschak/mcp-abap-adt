// DetectObjectTypeListJson: Batch detection by JSON payload

import { handleDetectObjectTypeListArray } from "./handleDetectObjectTypeListArray";

/**
 * DetectObjectTypeListJson handler.
 * @param args { payload: { objects: Array<{ name: string, type?: string }> } }
 * @returns Result of handleDetectObjectTypeListArray with objects from payload
 */
export async function handleDetectObjectTypeListJson(args: any) {
  if (!args.payload || !Array.isArray(args.payload.objects)) {
    throw new Error("Parameter 'payload.objects' must be an array.");
  }
  return await handleDetectObjectTypeListArray({ objects: args.payload.objects });
}
