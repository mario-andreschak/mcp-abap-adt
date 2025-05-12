import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosError, AxiosInstance } from "axios";
import { Agent } from "https";
import { AxiosResponse } from "axios";
import { getConfig, SapConfig } from "../index"; // getConfig needs to be exported from index.ts

export { McpError, ErrorCode, AxiosResponse };

export function return_response(response: AxiosResponse) {
  return {
    isError: false,
    content: [
      {
        type: "text",
        text: response.data,
      },
    ],
  };
}
export function return_error(error: any) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `Error: ${
          error instanceof AxiosError
            ? String(error.response?.data)
            : error instanceof Error
            ? error.message
            : String(error)
        }`,
      },
    ],
  };
}

let axiosInstance: AxiosInstance | null = null;
export function createAxiosInstance() {
  if (!axiosInstance) {
    axiosInstance = axios.create({
      httpsAgent: new Agent({
        rejectUnauthorized: false, // Allow self-signed certificates
      }),
    });
  }
  return axiosInstance;
}

// Cleanup function for tests
export function cleanup() {
  if (axiosInstance) {
    // Clear any interceptors
    const reqInterceptor = axiosInstance.interceptors.request.use(
      (config) => config
    );
    const resInterceptor = axiosInstance.interceptors.response.use(
      (response) => response
    );
    axiosInstance.interceptors.request.eject(reqInterceptor);
    axiosInstance.interceptors.response.eject(resInterceptor);
  }
  axiosInstance = null;
  config = undefined;
  csrfToken = null;
  cookies = null;
}

let config: SapConfig | undefined;
let csrfToken: string | null = null;
let cookies: string | null = null; // Variable to store cookies
let ssoTokenExpiry: number | null = null;

export async function getBaseUrl() {
  if (!config) {
    config = getConfig();
  }
  const { url } = config;
  try {
    const urlObj = new URL(url);
    return urlObj.origin;
  } catch (error) {
    const errorMessage = `Invalid URL in configuration: ${
      error instanceof Error ? error.message : error
    }`;
    throw new Error(errorMessage);
  }
}

/**
 * Fetches an SSO token from the identity provider
 * This is a placeholder implementation. In a real scenario you would:
 * 1. Redirect to SSO login page
 * 2. Process the auth code
 * 3. Exchange code for tokens
 * 4. Store and refresh tokens as needed
 */
export async function refreshSsoToken(): Promise<string> {
  try {
    if (!config) {
      config = getConfig();
    }

    // Check if we're configured for SSO
    if (config.authType !== "sso") {
      throw new Error(
        "SSO token refresh requested but authentication type is not SSO"
      );
    }

    // In a real implementation, this would make a request to get a new token if expired
    // For now, we'll just return the existing token or throw an error if none is set
    if (!config.ssoToken) {
      throw new Error("No SSO token available in configuration");
    }

    // Set a mock expiry time of 1 hour from now
    ssoTokenExpiry = Date.now() + 60 * 60 * 1000;

    return config.ssoToken;
  } catch (error) {
    throw new Error(
      `Failed to refresh SSO token: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Checks if the current SSO token is valid or needs to be refreshed
 * @returns true if token is valid, false if it needs to be refreshed
 */
export function isSsoTokenValid(): boolean {
  if (!ssoTokenExpiry) {
    return false;
  }

  // Check if token is about to expire (less than 5 minutes remaining)
  const fiveMinutes = 5 * 60 * 1000;
  return Date.now() < ssoTokenExpiry - fiveMinutes;
}

// Update getAuthHeaders to use token refreshing
export async function getAuthHeaders() {
  if (!config) {
    config = getConfig();
  }

  // Base headers that are always needed
  const headers: Record<string, string> = {
    "X-SAP-Client": config.client,
  };

  // Add authentication headers based on auth type
  if (config.authType === "basic" && config.username && config.password) {
    // Basic authentication
    const auth = Buffer.from(`${config.username}:${config.password}`).toString(
      "base64"
    );
    headers["Authorization"] = `Basic ${auth}`;
  } else if (config.authType === "xsuaa" && config.ssoToken) {
    // XSUAA JWT Bearer authentication
    headers["Authorization"] = `Bearer ${config.ssoToken}`;
  } else if (config.authType === "sso" && config.ssoToken) {
    // SSO cookie authentication (Eclipse/ADT style)
    // Do NOT add Authorization, only Cookie
    // Cookie will be added in makeAdtRequest
  } else {
    throw new Error("Invalid authentication configuration");
  }

  return headers;
}

async function fetchCsrfToken(url: string): Promise<string> {
  try {
    // Додаємо шлях /sap/bc/adt/discovery до URL якщо його немає
    // Це стандартний ендпоінт для отримання CSRF-токена в SAP ABAP системах
    let csrfUrl = url;
    if (!url.includes("/sap/bc/adt/")) {
      csrfUrl = `${url}/sap/bc/adt/discovery`;
    }

    // Логування CSRF-запиту тільки якщо DEBUG=true і не xsuaa
    if (process.env.DEBUG === "true" && config?.authType !== "xsuaa") {
      console.log(`Отримую CSRF-токен з: ${csrfUrl}`);
    }

    const response = await createAxiosInstance()({
      method: "GET",
      url: csrfUrl,
      headers: {
        ...(await getAuthHeaders()),
        "x-csrf-token": "fetch",
        Accept: "application/xml",
      },
    });

    const token = response.headers["x-csrf-token"];
    if (!token) {
      throw new Error("No CSRF token in response headers");
    }

    // Extract and store cookies
    if (response.headers["set-cookie"]) {
      cookies = response.headers["set-cookie"].join("; ");
    }

    return token;
  } catch (error) {
    // Виводимо деталі помилки для відладки
    if (error instanceof AxiosError) {
      if (process.env.DEBUG === "true" && config?.authType !== "xsuaa") {
        console.error(`CSRF токен помилка: ${error.message}`);
        if (error.response) {
          console.error(`Статус: ${error.response.status}`);
          console.error(`Заголовки: ${JSON.stringify(error.response.headers)}`);
          console.error(`Дані: ${error.response.data?.slice(0, 200)}...`);
        }
      }
      // Якщо 405 — це не критична помилка, CSRF токен часто все одно повертається (SAP специфіка)
      if (
        error.response?.status === 405 &&
        error.response?.headers["x-csrf-token"]
      ) {
        if (process.env.DEBUG === "true") {
          console.warn(
            "CSRF: SAP повернув 405 (Method Not Allowed) — це не критично, токен може бути у заголовку."
          );
        }
        const token = error.response.headers["x-csrf-token"];
        if (token) {
          if (error.response.headers["set-cookie"]) {
            cookies = error.response.headers["set-cookie"].join("; ");
          }
          return token;
        }
      }
      // Перевіряємо заголовки відповіді на наявність CSRF токена навіть при інших помилках
      if (error.response?.headers["x-csrf-token"]) {
        const token = error.response.headers["x-csrf-token"];
        if (error.response.headers["set-cookie"]) {
          cookies = error.response.headers["set-cookie"].join("; ");
        }
        return token;
      }
    }

    // Якщо не вдалося отримати CSRF токен, змінимо поведінку в режимі SSO
    if (config && config.authType === "sso") {
      console.warn(
        "CSRF токен не знайдено, але в режимі SSO продовжуємо без нього."
      );
      // Повертаємо токен-заглушку, яка буде використовуватися лише для SSO запитів
      return "SSO_MODE";
    }

    // Для базової автентифікації все ще вимагаємо справжній CSRF токен
    throw new Error(
      `Failed to fetch CSRF token: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function makeAdtRequest(
  url: string,
  method: string,
  timeout: number,
  data?: any,
  params?: any
) {
  // Додаємо правильні шляхи ADT до URL, якщо вони відсутні
  let requestUrl = url;
  if (!url.includes("/sap/bc/adt/") && !url.endsWith("/sap/bc/adt")) {
    if (url.endsWith("/")) {
      requestUrl = `${url}sap/bc/adt`;
    } else {
      requestUrl = `${url}/sap/bc/adt`;
    }
  }

  // Для SSO не вимагаємо CSRF токен для POST/PUT запитів
  const isSSO = config && config.authType === "sso";

  // Для POST/PUT запитів, отримуємо CSRF токен (за винятком режиму SSO)
  if ((method === "POST" || method === "PUT") && !csrfToken && !isSSO) {
    try {
      csrfToken = await fetchCsrfToken(requestUrl);
    } catch (error) {
      throw new Error(
        "CSRF token is required for POST/PUT requests but could not be fetched"
      );
    }
  } else if ((method === "POST" || method === "PUT") && isSSO && !csrfToken) {
    // В режимі SSO спробуємо отримати токен, але продовжимо навіть без нього
    try {
      csrfToken = await fetchCsrfToken(requestUrl);
    } catch (error) {
      console.warn("SSO режим: працюємо без CSRF токена");
      csrfToken = "SSO_MODE"; // використовуємо заглушку
    }
  }

  const requestHeaders = {
    ...(await getAuthHeaders()),
  };

  // Add CSRF token for POST/PUT requests
  if ((method === "POST" || method === "PUT") && csrfToken) {
    requestHeaders["x-csrf-token"] = csrfToken;
  }

  // Add cookies if available or for SSO authType
  if (cookies) {
    requestHeaders["Cookie"] = cookies;
  } else if (config && config.authType === "sso" && config.ssoToken) {
    requestHeaders["Cookie"] = config.ssoToken;
  }

  // Додаємо Accept заголовок для ADT запитів
  if (!requestHeaders["Accept"]) {
    requestHeaders["Accept"] =
      "application/xml, application/json, text/plain, */*";
  }

  const requestConfig: any = {
    method,
    url: requestUrl,
    headers: requestHeaders,
    timeout,
    params: params,
  };

  // Include data in the request configuration if provided
  if (data) {
    requestConfig.data = data;
  }

  console.log(`Виконую запит до: ${requestUrl} (метод: ${method})`);

  try {
    const response = await createAxiosInstance()(requestConfig);
    return response;
  } catch (error) {
    // Логування деталей помилки
    if (error instanceof AxiosError) {
      console.error(`Помилка запиту: ${error.message}`);
      if (error.response) {
        console.error(`Статус: ${error.response.status}`);
        console.error(
          `Дані: ${
            typeof error.response.data === "string"
              ? error.response.data.slice(0, 200)
              : JSON.stringify(error.response.data).slice(0, 200)
          }...`
        );
      }
    }

    // If we get a 403 with "CSRF token validation failed", try to fetch a new token and retry
    if (
      error instanceof AxiosError &&
      error.response?.status === 403 &&
      error.response.data?.includes("CSRF")
    ) {
      csrfToken = await fetchCsrfToken(requestUrl);
      requestConfig.headers["x-csrf-token"] = csrfToken;
      return await createAxiosInstance()(requestConfig);
    }
    throw error;
  }
}
