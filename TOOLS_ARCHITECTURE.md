# Архітектура інструментів MCP ABAP ADT

## Проблема

Раніше всі описи інструментів знаходилися в `index.ts`, що призводило до проблем:
- Коли LLM вносив правки по одному модулю, вона могла зламати всі описи
- Важко було підтримувати синхронізацію між хендлерами та їх описами
- Дублювання коду та ризик неузгодженості

## Рішення

Кожен модуль тепер відповідає за свій власний опис через константну структуру `TOOL_DEFINITION`, яка експортується з кожного хендлера.

## Структура

### 1. Хендлери з описами

Кожен хендлер (наприклад, `src/handlers/handleGetProgram.ts`) містить:

```typescript
export const TOOL_DEFINITION = {
  name: "GetProgram",
  description: "Retrieve ABAP program source code. Returns only the main program source code without includes or enhancements.",
  inputSchema: {
    type: "object",
    properties: {
      program_name: { type: "string", description: "Name of the ABAP program" }
    },
    required: ["program_name"]
  }
} as const;

export async function handleGetProgram(args: any) {
  // Логіка хендлера
}
```

### 2. Центральний реєстр

Файл `src/lib/toolsRegistry.ts`:
- Імпортує всі `TOOL_DEFINITION` з хендлерів
- Збирає їх в єдиний масив `ALL_TOOLS`
- Експортує функції для роботи з інструментами

```typescript
import { TOOL_DEFINITION as GetProgram_Tool } from '../handlers/handleGetProgram';
import { TOOL_DEFINITION as GetClass_Tool } from '../handlers/handleGetClass';
// ... інші імпорти

export const ALL_TOOLS: ToolDefinition[] = [
  GetProgram_Tool,
  GetClass_Tool,
  // ... інші інструменти
];

export function getAllTools(): ToolDefinition[] {
  return ALL_TOOLS;
}
```

### 3. Використання в index.ts

`index.ts` тепер використовує динамічний реєстр замість жорстко закодованого списку:

```typescript
import { getAllTools } from "./lib/toolsRegistry";

// Handler for ListToolsRequest
this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: getAllTools()
}));
```

## Переваги

1. **Локальність**: Кожен хендлер відповідає за свій опис
2. **Безпечність**: Зміни в одному хендлері не впливають на інші
3. **Підтримуваність**: Легко додавати нові інструменти
4. **Типобезпека**: TypeScript перевіряє узгодженість типів
5. **DRY принцип**: Немає дублювання описів

## Як додати новий інструмент

1. Створіть новий хендлер у `src/handlers/`
2. Додайте `TOOL_DEFINITION` в хендлер:
   ```typescript
   export const TOOL_DEFINITION = {
     name: "YourToolName",
     description: "Description of what your tool does",
     inputSchema: {
       type: "object",
       properties: {
         // ваші параметри
       },
       required: ["required_param"]
     }
   } as const;
   ```
3. Додайте імпорт та інструмент в `src/lib/toolsRegistry.ts`
4. Додайте case в `CallToolRequestSchema` handler в `index.ts`

## Автоматизація

Створено скрипт `tools/update-handlers-with-tool-definitions.js` для автоматичного додавання `TOOL_DEFINITION` до існуючих хендлерів.

Запуск:
```bash
node tools/update-handlers-with-tool-definitions.js
```

## Майбутні покращення

- Можна додати автоматичну валідацію узгодженості між хендлерами та їх описами
- Можна створити CLI інструмент для генерації нових хендлерів з шаблонами
- Можна додати автоматичну генерацію документації з описів інструментів
