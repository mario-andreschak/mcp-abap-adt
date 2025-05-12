#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const dotenv = require("dotenv");
const { program } = require("commander");

// Шлях до .env файлу відносно кореня проекту
const ENV_FILE_PATH = path.resolve(process.cwd(), ".env");

/**
 * Читає JSON-файл з service key
 * @param {string} filePath Шлях до файлу service key
 * @returns {object} Об'єкт з даними service key
 */
function readServiceKey(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`Файл не знайдено: ${fullPath}`);
      process.exit(1);
    }

    const fileContent = fs.readFileSync(fullPath, "utf8");
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Помилка при читанні service key: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Оновлює .env файл з новими значеннями
 * @param {Object} updates Об'єкт з оновленими значеннями
 */
function updateEnvFile(updates) {
  try {
    // Перевіряємо наявність .env файлу
    if (!fs.existsSync(ENV_FILE_PATH)) {
      console.error(`.env файл не знайдено за шляхом: ${ENV_FILE_PATH}`);
      console.log("Створюю новий .env файл...");

      // Створюємо базовий .env файл
      const defaultEnv = `SAP_URL=https://your-abap-system.com
SAP_CLIENT=100
SAP_LANGUAGE=en
TLS_REJECT_UNAUTHORIZED=0

# Authentication type: basic or sso
SAP_AUTH_TYPE=sso

# For SSO authentication
SAP_SSO_TOKEN=your_sso_token_here

# Basic authentication settings (not used with SSO)
# SAP_USERNAME=your_username
# SAP_PASSWORD=your_password
`;
      fs.writeFileSync(ENV_FILE_PATH, defaultEnv, "utf8");
    }

    // Читаємо поточний .env файл
    let envContent = fs.readFileSync(ENV_FILE_PATH, "utf8");

    // Оновлюємо значення в .env файлі
    Object.entries(updates).forEach(([key, value]) => {
      // Перевіряємо, чи існує ключ у файлі
      const regex = new RegExp(`^${key}=.*$`, "m");

      if (regex.test(envContent)) {
        // Оновлюємо існуюче значення
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        // Додаємо нове значення
        envContent += `\n${key}=${value}`;
      }
    });

    // Зберігаємо оновлений .env файл
    fs.writeFileSync(ENV_FILE_PATH, envContent, "utf8");
    console.log(".env файл успішно оновлено.");
  } catch (error) {
    console.error(`Помилка при оновленні .env файлу: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Отримує OAuth токен з SAP BTP
 * @param {Object} serviceKey Об'єкт з SAP BTP service key
 * @returns {Promise<string>} OAuth токен
 */
async function fetchOAuthToken(serviceKey) {
  try {
    // Отримуємо необхідні дані з service key
    const { url, clientid, clientsecret, tokenendpoint } = serviceKey.uaa;

    // Формуємо запит на отримання токену через client credentials flow
    const tokenUrl = tokenendpoint || `${url}/oauth/token`;
    const authString = Buffer.from(`${clientid}:${clientsecret}`).toString(
      "base64"
    );

    const response = await axios({
      method: "post",
      url: tokenUrl,
      headers: {
        Authorization: `Basic ${authString}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: "grant_type=client_credentials",
    });

    if (response.data && response.data.access_token) {
      console.log("OAuth токен успішно отримано.");
      return response.data.access_token;
    } else {
      throw new Error("Відповідь не містить access_token");
    }
  } catch (error) {
    if (error.response) {
      console.error(
        `Помилка API (${error.response.status}): ${JSON.stringify(
          error.response.data
        )}`
      );
    } else {
      console.error(`Помилка при отриманні OAuth токену: ${error.message}`);
    }
    process.exit(1);
  }
}

/**
 * Отримує URL API ABAP системи з service key
 * @param {Object} serviceKey Об'єкт з SAP BTP service key
 * @returns {string} URL API ABAP системи
 */
function getAbapUrl(serviceKey) {
  try {
    // Перевіряємо різні можливі структури service key
    if (serviceKey.url) {
      return serviceKey.url;
    } else if (serviceKey.endpoints && serviceKey.endpoints.api) {
      return serviceKey.endpoints.api;
    } else if (serviceKey.abap && serviceKey.abap.url) {
      return serviceKey.abap.url;
    } else {
      throw new Error("Не вдалося знайти URL ABAP системи в service key");
    }
  } catch (error) {
    console.error(`Помилка при отриманні URL ABAP системи: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Отримує клієнт ABAP системи з service key
 * @param {Object} serviceKey Об'єкт з SAP BTP service key
 * @returns {string} Клієнт ABAP системи
 */
function getAbapClient(serviceKey) {
  try {
    // Перевіряємо різні можливі структури service key
    if (serviceKey.sapClient) {
      return serviceKey.sapClient;
    } else if (serviceKey.abap && serviceKey.abap.sapClient) {
      return serviceKey.abap.sapClient;
    } else {
      // За замовчуванням для хмарних систем
      return "100";
    }
  } catch (error) {
    console.error(
      `Помилка при отриманні клієнта ABAP системи: ${error.message}`
    );
    process.exit(1);
  }
}

/**
 * Головна функція програми
 */
async function main() {
  program
    .name("sap-abap-auth")
    .description(
      "CLI утиліта для автентифікації в SAP ABAP системах через service key"
    )
    .version("1.0.0");

  program
    .command("auth")
    .description("Автентифікація в SAP ABAP системі і оновлення .env файлу")
    .requiredOption(
      "-k, --key <path>",
      "Шлях до файлу service key в форматі JSON"
    )
    .action(async (options) => {
      try {
        console.log("Починаю процес автентифікації...");

        // Читаємо service key
        const serviceKey = readServiceKey(options.key);
        console.log("Service key успішно зчитано.");

        // Отримуємо OAuth токен
        const token = await fetchOAuthToken(serviceKey);

        // Отримуємо URL ABAP системи
        const abapUrl = getAbapUrl(serviceKey);

        // Отримуємо клієнт ABAP системи
        const abapClient = getAbapClient(serviceKey);

        // Оновлюємо .env файл
        updateEnvFile({
          SAP_URL: abapUrl,
          SAP_CLIENT: abapClient,
          SAP_AUTH_TYPE: "sso",
          SAP_SSO_TOKEN: token,
          TLS_REJECT_UNAUTHORIZED: "0",
        });

        console.log("Автентифікація успішно завершена!");
      } catch (error) {
        console.error(`Помилка при автентифікації: ${error.message}`);
        process.exit(1);
      }
    });

  program.parse();
}

// Запускаємо головну функцію
main();
