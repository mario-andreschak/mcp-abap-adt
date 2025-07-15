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
  const objects = args?.objects;
  console.error("DescribeByList args:", args);
  console.error("DescribeByList objects:", objects);
  if (!args || !Array.isArray(objects) || objects.length === 0) {
    return { content: [] };
  }
  const results: any[] = [];
  try {
    for (const obj of objects) {
      let type = obj.type;
      if (type === "TABLE") {
        type = "TABL";
      } else if (type && typeof type === "string" && !type.includes("/")) {
        type = `${type}/*`;
      }
      const res = await handleSearchObject({ object_name: obj.name, object_type: type });
      // Parse response and filter errors
      let parsed;
      try {
        parsed = typeof res === "string" ? JSON.parse(res) : res;
        if (parsed.isError === true) continue;
        // Додаткова перевірка: якщо content порожній або XML не містить objectReference — пропускати
        const xmlText = parsed.content?.[0]?.text || "";
        if (!xmlText.includes("<adtcore:objectReference")) continue;
        // Додаємо тільки якщо знайдено objectReference
        results.push({ type: "text", text: JSON.stringify(res) });
      } catch {
        // If cannot parse, skip
        continue;
      }
    }
    console.error("DescribeByList results:", results);
    return { content: results };
  } catch (e) {
    console.error("DescribeByList error:", e);
    return { content: [] };
  }
}
