// DetectObjectTypeListArray: Batch detection by array

import { handleDetectObjectTypeList } from "./handleDetectObjectTypeList";

/**
 * DetectObjectTypeListArray handler.
 * @param args { objects: Array<{ name: string, type?: string }> }
 * @returns Result of handleDetectObjectTypeList with objects
 */
export async function handleDetectObjectTypeListArray(args: any) {
  if (!Array.isArray(args.objects)) {
    throw new Error("Parameter 'objects' must be an array.");
  }
  return await handleDetectObjectTypeList({ objects: args.objects });
}
