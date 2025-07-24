# ABAP Parser and Semantic Analysis Tools

Цей документ описує нові інструменти для парсингу та семантичного аналізу ABAP коду, які були додані до MCP ABAP ADT сервера.

## Огляд

Було додано три нових інструменти:

1. **GetAbapAST** - Парсинг ABAP коду та генерація AST (Abstract Syntax Tree)
2. **GetAbapSemanticAnalysis** - Семантичний аналіз з визначенням символів, типів та скоупів
3. **GetAbapSystemSymbols** - Резолюція символів з SAP системи з додатковою інформацією

## Налаштування

### Makefile

Створений Makefile для автоматизації роботи з ANTLR4:

```bash
# Завантаження ANTLR4 та генерація парсера
make setup generate

# Збірка проекту
make build

# Розробка (генерація + збірка + запуск)
make dev

# Тестування
make test

# Очистка згенерованих файлів
make clean

# Повна очистка (включаючи ANTLR JAR)
make clean-all
```

### Автоматична генерація парсера

Парсер автоматично генерується при збірці проекту:

```bash
npm run build  # Спочатку запускає make generate, потім tsc
```

### Ігнорування згенерованих файлів

Згенеровані файли автоматично ігноруються Git:
- `src/generated/` - згенеровані файли парсера
- `tools/antlr/` - JAR файл ANTLR4

## Інструменти

### 1. GetAbapAST

Парсить ABAP код та повертає AST дерево в JSON форматі.

**Параметри:**
- `code` (обов'язковий) - ABAP код для парсингу
- `filePath` (опціональний) - шлях до файлу для збереження результату

**Приклад використання:**
```json
{
  "code": "CLASS zcl_test DEFINITION.\n  PUBLIC SECTION.\n    METHODS: test.\nENDCLASS.",
  "filePath": "output/ast.json"
}
```

**Результат:**
```json
{
  "type": "abapSource",
  "sourceLength": 85,
  "lineCount": 4,
  "structures": [
    {
      "type": "class",
      "line": 1,
      "content": "CLASS zcl_test DEFINITION."
    }
  ],
  "classes": [
    {
      "name": "zcl_test",
      "type": "definition",
      "position": 0
    }
  ],
  "methods": [
    {
      "name": "test",
      "position": 50
    }
  ]
}
```

### 2. GetAbapSemanticAnalysis

Виконує семантичний аналіз ABAP коду та повертає символи, типи, скоупи та залежності.

**Параметри:**
- `code` (обов'язковий) - ABAP код для аналізу
- `filePath` (опціональний) - шлях до файлу для збереження результату

**Приклад використання:**
```json
{
  "code": "CLASS zcl_test DEFINITION.\n  PUBLIC SECTION.\n    DATA: lv_text TYPE string.\n    METHODS: process IMPORTING iv_input TYPE string.\nENDCLASS.",
  "filePath": "output/semantic.json"
}
```

**Результат:**
```json
{
  "symbols": [
    {
      "name": "ZCL_TEST",
      "type": "class",
      "scope": "global",
      "line": 1,
      "column": 1,
      "visibility": "public"
    },
    {
      "name": "LV_TEXT",
      "type": "variable",
      "scope": "ZCL_TEST",
      "line": 3,
      "column": 1,
      "dataType": "STRING",
      "visibility": "public"
    },
    {
      "name": "PROCESS",
      "type": "method",
      "scope": "ZCL_TEST",
      "line": 4,
      "column": 1,
      "visibility": "public",
      "parameters": [
        {
          "name": "IV_INPUT",
          "type": "importing",
          "dataType": "STRING"
        }
      ]
    }
  ],
  "dependencies": [],
  "errors": [],
  "scopes": [
    {
      "name": "ZCL_TEST",
      "type": "class",
      "startLine": 1,
      "endLine": 5
    }
  ]
}
```

### 3. GetAbapSystemSymbols

Виконує семантичний аналіз та резолює символи з SAP системи, додаючи додаткову інформацію про пакети, описи та системні властивості.

**Параметри:**
- `code` (обов'язковий) - ABAP код для аналізу та резолюції
- `filePath` (опціональний) - шлях до файлу для збереження результату

**Приклад використання:**
```json
{
  "code": "CLASS cl_salv_table DEFINITION.\n  METHODS: factory.\nENDCLASS.",
  "filePath": "output/system_symbols.json"
}
```

**Результат:**
```json
{
  "symbols": [
    {
      "name": "CL_SALV_TABLE",
      "type": "class",
      "scope": "global",
      "line": 1,
      "column": 1,
      "visibility": "public",
      "systemInfo": {
        "exists": true,
        "objectType": "CLAS",
        "description": "ALV Table in Object Oriented Environment",
        "package": "SALV_OM",
        "methods": ["FACTORY", "GET_COLUMNS", "DISPLAY"],
        "interfaces": ["IF_SALV_TABLE"],
        "attributes": ["MR_TABLE"]
      }
    }
  ],
  "dependencies": [],
  "errors": [],
  "scopes": [
    {
      "name": "CL_SALV_TABLE",
      "type": "class",
      "startLine": 1,
      "endLine": 3
    }
  ],
  "systemResolutionStats": {
    "totalSymbols": 1,
    "resolvedSymbols": 1,
    "failedSymbols": 0,
    "resolutionRate": "100.0%"
  }
}
```

## Архітектура

### Компоненти

1. **Makefile** - Автоматизація ANTLR4 та збірки
2. **Abap.g4** - Граматика ABAP для ANTLR4
3. **src/lib/abapParser.ts** - Основні класи для парсингу та аналізу
4. **src/handlers/handleGetAbapAST.ts** - Хендлер для AST
5. **src/handlers/handleGetAbapSemanticAnalysis.ts** - Хендлер для семантичного аналізу
6. **src/handlers/handleGetAbapSystemSymbols.ts** - Хендлер для системної резолюції

### Workflow

1. **Парсинг** - ABAP код парситься за допомогою спрощеного парсера (до повного впровадження ANTLR4)
2. **Семантичний аналіз** - Визначаються символи, типи, скоупи та залежності
3. **Системна резолюція** - Символи резолюються з SAP системи через існуючі ADT хендлери

### Плани на майбутнє

- Повне впровадження ANTLR4 для більш точного парсингу
- Розширення граматики для підтримки більше ABAP конструкцій
- Додавання контекстуального аналізу та валідації
- Інтеграція з більшою кількістю SAP системних API

## Використання в розробці

### Приклади команд

```bash
# Налаштування середовища
make setup

# Розробка з автоматичною генерацією
make dev

# Тестування нових інструментів
npm test

# Очистка та повна пересборка
make clean-all && make all
```

### Інтеграція з існуючими інструментами

Нові інструменти інтегровані з існуючою інфраструктурою:
- Використовують той самий реєстр інструментів
- Підтримують той самий формат відповідей
- Інтегровані з існуючими SAP ADT хендлерами для резолюції символів

### Налагодження

Всі інструменти підтримують опціональний параметр `filePath` для збереження результатів у файл, що полегшує налагодження та аналіз результатів.
