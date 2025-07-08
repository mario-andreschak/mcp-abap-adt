# MCP ABAP ADT Handlers: Return & File Formats

| Handler Name                | Повертає (return)                | Формат повернення         | Зберігає у файл (filePath) | Формат у файлі         |
|-----------------------------|----------------------------------|---------------------------|----------------------------|------------------------|
| handleGetProgram            | JSON: { isError, content[{type:"text", text}] } | JSON (старий формат)      | plain text                | багаторядковий текст   |
| handleGetInclude            | JSON: { isError, content[{type:"text", text}] } | JSON (старий формат)      | plain text                | багаторядковий текст   |
| handleGetFunction           | JSON: { isError, content[{type:"text", text}] } або {isError, content[{type:"json", json}]} | JSON (старий формат)      | plain text або JSON     | багаторядковий текст або JSON |
| handleGetClass              | JSON: { isError, content[{type:"text", text}]} або {isError, content[{type:"json", json}]}  | JSON (старий формат)      | plain text або JSON     | багаторядковий текст або JSON |
| handleGetFunctionGroup      | JSON: { isError, content[{type:"json", json}]}  | JSON (старий формат)      | JSON                      | JSON                  |
| handleGetStructure          | JSON: { isError, content[{type:"json", json}]}  | JSON (старий формат)      | JSON                      | JSON                  |
| handleGetTable              | JSON: { isError, content[{type:"json", json}]}  | JSON (старий формат)      | JSON                      | JSON                  |
| handleGetTableContents      | JSON: { isError, content[{type:"text", text}]}  | JSON (старий формат)      | JSON                      | JSON                  |
| handleGetPackage            | JSON: { isError, content[{type:"text", text}]}  | JSON (старий формат)      | JSON                      | JSON                  |
| handleGetTypeInfo           | JSON: { isError, content[{type:"json", json}]}  | JSON (старий формат)      | JSON                      | JSON                  |
| handleGetInterface          | JSON: { isError, content[{type:"text", text}]}  | JSON (старий формат)      | JSON                      | JSON                  |
| handleGetTransaction        | JSON: { isError, content[{type:"json", json}]}  | JSON (старий формат)      | JSON                      | JSON                  |
| handleSearchObject          | JSON: { isError, content[{type:"text", text}]}  | JSON (старий формат)      | JSON                      | JSON                  |
| handleGetEnhancements       | JSON: { isError, content[{type:"text", text}]}  | JSON (старий формат)      | JSON                      | JSON                  |
| handleGetEnhancementSpot    | JSON: { isError, content[{type:"json", json}]}  | JSON (старий формат)      | JSON                      | JSON                  |
| handleGetEnhancementImpl    | JSON: { isError, content[{type:"json", json}]}  | JSON (старий формат)      | JSON                      | JSON                  |
| handleGetSqlQuery           | JSON: { isError, content[{type:"text", text}]}  | JSON (старий формат)      | JSON                      | JSON                  |
| handleGetIncludesList       | JSON: { isError, content[{type:"text", text}]} або {type:"json", json} | JSON (старий формат)      | JSON                      | JSON                  |
| handleGetObjectsByType      | JSON: { isError, content[{type:"text", text}]} або {type:"json", json} | JSON (старий формат)      | JSON                      | JSON                  |
| handleGetWhereUsed          | JSON: { isError, content[{type:"text", text}]}  | JSON (старий формат)      | JSON                      | JSON                  |
| handleGetBdef               | JSON: { isError, content[{type:"text", text}]} або {type:"json", json} | JSON (старий формат)      | JSON                      | JSON                  |

**Примітки:**
- Для plain text (ісходний код програм, інклюдів, функцій, класів) у файл завжди зберігається багаторядковий текст, а не JSON.
- Для структурованих даних (структури, таблиці, групи функцій) повертається і зберігається JSON.
- Якщо повертається помилка — завжди { isError: true, content: [{type: "text", text: "..."}] }.

Оновлено: 2025-07-08
