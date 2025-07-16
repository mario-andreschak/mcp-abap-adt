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
  if (!args || !Array.isArray(objects) || objects.length === 0) {
    const err = new Error("Missing or invalid parameters: objects (array) is required and must not be empty.");
    // @ts-ignore
    err.status = 400;
    // @ts-ignore
    err.body = {
      error: {
        message: "Missing or invalid parameters: objects (array) is required and must not be empty.",
        code: "INVALID_PARAMS"
      }
    };
    throw err;
  }
  const results: any[] = [];
  try {
    for (const obj of objects) {
      let type = obj.type;
      let res = await handleSearchObject({ object_name: obj.name, object_type: type });
      let parsed;
      try {
        parsed = typeof res === "string" ? JSON.parse(res) : res;

        // Якщо відповідь пуста або isError === true, пробуємо ще раз без типу
        let tryWithoutType = false;
        if (
          (parsed == null) ||
          (parsed.isError === true) ||
          (parsed.content && Array.isArray(parsed.content) && parsed.content.length === 0)
        ) {
          tryWithoutType = true;
        }

        if (tryWithoutType) {
          res = await handleSearchObject({ object_name: obj.name });
          parsed = typeof res === "string" ? JSON.parse(res) : res;
          // Якщо знову помилка або порожньо — пропускаємо цей об'єкт
          if (
            (parsed == null) ||
            (parsed.isError === true) ||
            (parsed.content && Array.isArray(parsed.content) && parsed.content.length === 0)
          ) {
            continue;
          }
        }

        // Якщо є content і це масив
        if (parsed.content && Array.isArray(parsed.content)) {
          const contentArr = parsed.content;
          if (contentArr.length === 0) {
            continue;
          }
          // Якщо це SearchObject-style результат з масивом results
          let allResults: any[] = [];
          for (const item of contentArr) {
            try {
              let parsedItem = typeof item.text === "string" ? JSON.parse(item.text) : item.text;
              if (parsedItem && parsedItem.results && Array.isArray(parsedItem.results)) {
                allResults = allResults.concat(parsedItem.results);
              } else {
                allResults.push(parsedItem);
              }
            } catch {
              allResults.push(item);
            }
          }
          results.push({
            type: "text",
            text: JSON.stringify({
              name: obj.name,
              results: allResults
            })
          });
          continue;
        }

        // Якщо це просто валідний об'єкт (наприклад, DTEL)
        if (typeof parsed === "object" && parsed !== null) {
          results.push({ type: "text", text: JSON.stringify(parsed) });
        }
      } catch {
        continue;
      }
    }
    // Якщо жоден об'єкт не знайдено, повертаємо isError: false
    return {
      isError: false,
      content: results
    };
  } catch (e) {
    return { isError: true, content: [] };
  }
}
