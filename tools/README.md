# SAP ABAP SSO Authentication CLI

Ця CLI-утиліта дозволяє автоматично отримувати OAuth токен для підключення до SAP BTP ABAP Environment через SSO, використовуючи service key.

## Вимоги

- Node.js (>= 14.x)
- Service key файл у форматі JSON з SAP BTP ABAP Environment

## Створення Service Key

1. Увійдіть до SAP BTP Cockpit
2. Перейдіть до свого ABAP Environment (або Trial)
3. Виберіть "Service Keys" (або створіть інстанс сервісу, якщо його ще немає)
4. Створіть новий Service Key з потрібними параметрами
5. Скопіюйте JSON даних і збережіть у файл (наприклад, `abap-service-key.json`)

## Використання

```bash
# Використання через npm script
npm run auth -- -k path/to/service-key.json

# Або напряму через Node.js
node tools/sap-abap-auth.js auth -k path/to/service-key.json
```

## Результат

CLI утиліта:

1. Зчитає файл service key
2. Отримає OAuth токен через client credentials flow
3. Витягне URL та клієнт SAP ABAP системи
4. Оновить `.env` файл з необхідними значеннями для SSO автентифікації
5. Покаже статус операцій у консолі

## Структура файлу service key

Типова структура service key для SAP BTP ABAP Environment:

```json
{
  "uaa": {
    "clientid": "...",
    "clientsecret": "...",
    "url": "https://...",
    "tokenendpoint": "https://..."
  },
  "abap": {
    "url": "https://...",
    "sapClient": "100"
  },
  "endpoints": {
    "api": "https://..."
  }
}
```

## Для розробників

Якщо вам потрібно змінити логіку аутентифікації:

1. Модифікуйте функцію `fetchOAuthToken()` для іншого типу OAuth flow
2. Змініть функцію `getAbapUrl()` для іншого способу отримання URL
3. Оновіть схему `.env` файлу в функції `updateEnvFile()`
