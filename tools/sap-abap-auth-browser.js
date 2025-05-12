#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const dotenv = require("dotenv");
const { program } = require("commander");
const express = require("express");
const open = require("open").default;
const http = require("http");

// Шлях до .env файлу відносно кореня проекту
const ENV_FILE_PATH = path.resolve(process.cwd(), ".env");

// Вибір браузера через опцію --browser (chrome, edge, firefox, system)
const BROWSER_MAP = {
  chrome: "chrome",
  edge: "msedge",
  firefox: "firefox",
  system: undefined, // system default
};

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
 * Формує URL для автентифікації через XSUAA (OAuth2)
 * @param {Object} serviceKey Об'єкт з SAP BTP service key
 * @param {number} port Порт для redirect-url
 * @returns {string} URL для автентифікації
 */
function getXsuaaAuthorizationUrl(serviceKey, port = 3001) {
  const { url, clientid } = serviceKey.uaa;
  const redirectUri = `http://localhost:${port}/callback`;
  return `${url}/oauth/authorize?client_id=${encodeURIComponent(
    clientid
  )}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/**
 * Формує URL для автентифікації через reentranceticket (ADT-style)
 * @param {Object} serviceKey Об'єкт з SAP BTP service key
 * @param {number} port Порт для redirect-url
 * @returns {string} URL для автентифікації
 */
function getAdtAuthorizationUrl(serviceKey, port = 3001) {
  let abapUrl =
    serviceKey.endpoints && serviceKey.endpoints.abap
      ? serviceKey.endpoints.abap
      : serviceKey.url;
  abapUrl = abapUrl.replace(".abap.", ".abap-web.");
  const redirectUri = `http://localhost:${port}/adt/redirect`;
  return `${abapUrl}/sap/bc/adt/core/http/reentranceticket?redirect-url=${encodeURIComponent(
    redirectUri
  )}`;
}

/**
 * Запускає локальний сервер для перехоплення відповіді автентифікації
 * @param {Object} serviceKey Об'єкт з SAP BTP service key
 * @param {string} browser Браузер для відкриття
 * @param {string} flow Тип flow: xsuaa (OAuth2) або adt (SSO cookie)
 * @returns {Promise<string>} Promise, що повертає токен або cookie
 */
async function startAuthServer(serviceKey, browser = "system", flow = "xsuaa") {
  return new Promise((resolve, reject) => {
    const app = express();
    const server = http.createServer(app);
    const PORT = 3001;
    let serverInstance = null;

    // Вибираємо URL для авторизації залежно від flow
    const authorizationUrl =
      flow === "adt"
        ? getAdtAuthorizationUrl(serviceKey, PORT)
        : getXsuaaAuthorizationUrl(serviceKey, PORT);

    // XSUAA OAuth2 flow (отримуємо code, міняємо на токен)
    app.get("/callback", async (req, res) => {
      try {
        const { code } = req.query;
        if (!code) {
          res.status(400).send("Помилка: Код авторизації відсутній");
          return reject(new Error("Код авторизації відсутній"));
        }
        console.log("Отримано код авторизації");
        res.send(
          `<html><body style='font-family:sans-serif;text-align:center;margin-top:100px;'><h1>✅ Авторизація успішна!</h1><p>Можна закрити це вікно.</p></body></html>`
        );
        try {
          const token = await exchangeCodeForToken(serviceKey, code);
          server.close(() => {
            console.log("Сервер автентифікації зупинено");
          });
          resolve(token);
        } catch (error) {
          reject(error);
        }
      } catch (error) {
        console.error("Помилка при обробці callback:", error);
        res.status(500).send("Помилка при обробці автентифікації");
        reject(error);
      }
    });

    // ADT SSO cookie flow
    app.get("/adt/redirect", (req, res) => {
      const cookies = req.headers.cookie;
      if (
        cookies &&
        (cookies.includes("MYSAPSSO2") || cookies.includes("SAP_SESSIONID"))
      ) {
        updateEnvFile({ SAP_SSO_COOKIE: cookies });
        res.send(
          `<html><body style='font-family:sans-serif;text-align:center;margin-top:100px;'><h1>✅ SSO cookie отримано!</h1><p>Можна закрити це вікно та повернутися до застосунку.</p><p style='color:#666'>Cookie збережено у .env</p></body></html>`
        );
        server.close(() => {
          console.log("Сервер автентифікації зупинено");
        });
        resolve(cookies);
      } else {
        res.send(
          `<html><body style='font-family:sans-serif;text-align:center;margin-top:100px;'><h1>⚠️ Не вдалося отримати SSO cookie</h1><p>Спробуйте ще раз або перевірте налаштування.</p></body></html>`
        );
        reject(new Error("SSO cookie not found"));
      }
    });

    serverInstance = server.listen(PORT, () => {
      console.log(`Сервер автентифікації запущено на порту ${PORT}`);
      console.log("Відкриваю браузер для автентифікації...");
      const browserApp = BROWSER_MAP[browser] || undefined;
      if (browserApp) {
        open(authorizationUrl, { app: { name: browserApp } });
      } else {
        open(authorizationUrl);
      }
    });

    setTimeout(() => {
      if (serverInstance) {
        serverInstance.close();
        reject(new Error("Тайм-аут автентифікації. Процес перервано."));
      }
    }, 5 * 60 * 1000);
  });
}

/**
 * Обмінює код авторизації на токен
 * @param {Object} serviceKey Об'єкт з SAP BTP service key
 * @param {string} code Код авторизації
 * @returns {Promise<string>} Promise, що повертає токен
 */
async function exchangeCodeForToken(serviceKey, code) {
  try {
    const { url, clientid, clientsecret } = serviceKey.uaa;
    const tokenUrl = `${url}/oauth/token`;
    const redirectUri = "http://localhost:3001/callback";

    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", redirectUri);

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
      data: params.toString(),
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
    throw error;
  }
}

/**
 * Головна функція програми
 */
async function main() {
  program
    .name("sap-abap-auth-browser")
    .description(
      "CLI утиліта для автентифікації в SAP ABAP системах через браузер"
    )
    .version("1.0.0");

  program
    .command("auth")
    .description(
      "Автентифікація в SAP ABAP системі через браузер і оновлення .env файлу"
    )
    .requiredOption(
      "-k, --key <path>",
      "Шлях до файлу service key в форматі JSON"
    )
    .option(
      "-b, --browser <browser>",
      "Браузер для відкриття (chrome, edge, firefox, system)",
      "system"
    )
    .option(
      "-f, --flow <flow>",
      "Тип flow: xsuaa (OAuth2) або adt (SSO cookie)",
      "xsuaa"
    )
    .action(async (options) => {
      try {
        console.log("Починаю процес автентифікації...");

        // Читаємо service key
        const serviceKey = readServiceKey(options.key);
        console.log("Service key успішно зчитано.");

        // Запускаємо сервер для автентифікації та отримуємо токен або cookie
        console.log("Запускаю процес автентифікації через браузер...");
        const token = await startAuthServer(
          serviceKey,
          options.browser,
          options.flow
        );

        // Отримуємо URL ABAP системи
        const abapUrl = getAbapUrl(serviceKey);

        // Отримуємо клієнт ABAP системи
        const abapClient = getAbapClient(serviceKey);

        // Оновлюємо .env файл
        updateEnvFile({
          SAP_URL: abapUrl,
          SAP_CLIENT: abapClient,
          SAP_AUTH_TYPE: options.flow === "adt" ? "sso" : "xsuaa",
          SAP_SSO_TOKEN: token,
          TLS_REJECT_UNAUTHORIZED: "0",
        });

        console.log("Автентифікація успішно завершена!");
        process.exit(0);
      } catch (error) {
        console.error(`Помилка при автентифікації: ${error.message}`);
        process.exit(1);
      }
    });

  program.parse();
}

// Запускаємо головну функцію
main();
