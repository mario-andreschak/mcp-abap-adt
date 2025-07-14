# MCP ABAP ADT Handlers: Return & File Formats

| Handler Name                | Повертає (return)                | Формат повернення         |
|-----------------------------|----------------------------------|---------------------------|
| handleGetProgram            | { isError, content: [{type:"text", text}] } | MCP JSON (уніфікований)      |
| handleGetInclude            | { isError, content: [{type:"text", text}] } | MCP JSON (уніфікований)      |
| handleGetFunction           | { isError, content: [{type:"text", text}]} або {isError, content: [{type:"json", json}]} | MCP JSON (уніфікований)      |
| handleGetClass              | { isError, content: [{type:"text", text}]} або {isError, content: [{type:"json", json}]}  | MCP JSON (уніфікований)      |
| handleGetFunctionGroup      | { isError, content: [{type:"json", json}]}  | MCP JSON (уніфікований)      |
| handleGetStructure          | { isError, content: [{type:"json", json}]}  | MCP JSON (уніфікований)      |
| handleGetTable              | { isError, content: [{type:"json", json}]}  | MCP JSON (уніфікований)      |
| handleGetTableContents      | { isError, content: [{type:"text", text}]}  | MCP JSON (уніфікований)      |
| handleGetPackage            | { isError, content: [{type:"text", text}]}  | MCP JSON (уніфікований)      |
| handleGetTypeInfo           | { isError, content: [{type:"json", json}]}  | MCP JSON (уніфікований)      |
| handleGetInterface          | { isError, content: [{type:"text", text}]} або {type:"json", json} | MCP JSON (уніфікований)      |
| handleGetTransaction        | { isError, content: [{type:"json", json}]}  | MCP JSON (уніфікований)      |
| handleSearchObject          | { isError, content: [{type:"text", text}]}  | MCP JSON (уніфікований)      |
| handleGetEnhancements       | { isError, content: [{type:"json", json}]}  | MCP JSON (уніфікований)      |
| handleGetEnhancementSpot    | { isError, content: [{type:"json", json}]}  | MCP JSON (уніфікований)      |
| handleGetEnhancementImpl    | { isError, content: [{type:"json", json}]}  | MCP JSON (уніфікований)      |
| handleGetSqlQuery           | { isError, content: [{type:"text", text}]}  | MCP JSON (уніфікований)      |
| handleGetIncludesList       | { isError, content: [{type:"text", text}]} або {type:"json", json} | MCP JSON (уніфікований)      |
| handleGetObjectsByType      | { isError, content: [{type:"text", text}]} або {type:"json", json} | MCP JSON (уніфікований)      |
| handleGetObjectsList        | { isError, content: [{type:"json", json: {...}}] } | MCP JSON (уніфікований) |
| handleGetWhereUsed          | { isError, content: [{type:"json", json}]}  | MCP JSON (уніфікований)      |
| handleGetBdef               | { isError, content: [{type:"json", json}]} | MCP JSON (уніфікований)      |

**Примітки:**
- Якщо повертається помилка — завжди { isError: true, content: [{type: "text", text: "..."}] }.
- Поля `mimeType` і `data` більше не використовуються.
- Для type `"text"` використовується тільки поле `text`.
- Для type `"json"` використовується тільки поле `json`.
- Всі хендлери повертають уніфікований формат MCP.

Оновлено: 2025-07-14
