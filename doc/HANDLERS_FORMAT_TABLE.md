# MCP ABAP ADT Handlers: Return & File Formats

| Handler Name                | Повертає (return)                | Формат повернення         |
|-----------------------------|----------------------------------|---------------------------|
| handleGetProgram            | JSON: { isError, content[{type:"text", text}] } | JSON (старий формат)      |
| handleGetInclude            | JSON: { isError, content[{type:"text", text}] } | JSON (старий формат)      |
| handleGetFunction           | JSON: { isError, content[{type:"text", text}]} або {isError, content[{type:"json", json}]} | JSON (старий формат)      |
| handleGetClass              | JSON: { isError, content[{type:"text", text}]} або {isError, content[{type:"json", json}]}  | JSON (старий формат)      |
| handleGetFunctionGroup      | JSON: { isError, content[{type:"json", json}]}  | JSON (старий формат)      |
| handleGetStructure          | JSON: { isError, content[{type:"json", json}]}  | JSON (старий формат)      |
| handleGetTable              | JSON: { isError, content[{type:"json", json}]}  | JSON (старий формат)      |
| handleGetTableContents      | JSON: { isError, content[{type:"text", text}]}  | JSON (старий формат)      |
| handleGetPackage            | JSON: { isError, content[{type:"text", text}]}  | JSON (старий формат)      |
| handleGetTypeInfo           | JSON: { isError, content[{type:"json", json}]}  | JSON (старий формат)      |
| handleGetInterface          | JSON: { isError, content[{type:"text", text}]}  | JSON (старий формат)      |
| handleGetTransaction        | JSON: { isError, content[{type:"json", json}]}  | JSON (старий формат)      |
| handleSearchObject          | JSON: { isError, content[{type:"text", text}]}  | JSON (старий формат)      |
| handleGetEnhancements       | JSON: { isError, content[{type:"text", text}]}  | JSON (старий формат)      |
| handleGetEnhancementSpot    | JSON: { isError, content[{type:"json", json}]}  | JSON (старий формат)      |
| handleGetEnhancementImpl    | JSON: { isError, content[{type:"json", json}]}  | JSON (старий формат)      |
| handleGetSqlQuery           | JSON: { isError, content[{type:"text", text}]}  | JSON (старий формат)      |
| handleGetIncludesList       | JSON: { isError, content[{type:"text", text}]} або {type:"json", json} | JSON (старий формат)      |
| handleGetObjectsByType      | JSON: { isError, content[{type:"text", text}]} або {type:"json", json} | JSON (старий формат)      |
| handleGetObjectsList        | JSON: { content: [{type:"json", json: {parent_name, parent_tech_name, parent_type, total_objects, objects: [ { ...fields... } ]}}] } | JSON (новий формат) |
| handleGetWhereUsed          | JSON: { isError, content[{type:"text", text}]}  | JSON (старий формат)      |
| handleGetBdef               | JSON: { isError, content[{type:"text", text}]} або {type:"json", json} | JSON (старий формат)      |

**Примітки:**
- Якщо повертається помилка — завжди { isError: true, content: [{type: "text", text: "..."}] }.

Оновлено: 2025-07-08
