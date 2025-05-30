import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosError, AxiosInstance } from "axios";
import { Agent } from "https";
import { AxiosResponse } from "axios";
import { getConfig, SapConfig } from "../index"; // getConfig needs to be exported from index.ts
import { logger } from "./logger"; // Import the MCP-compatible logger

export { McpError, ErrorCode, AxiosResponse, logger };

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
    // Respect TLS_REJECT_UNAUTHORIZED environment variable
    // NODE_TLS_REJECT_UNAUTHORIZED=0 is the standard way to disable certificate validation
    // but we also support our own TLS_REJECT_UNAUTHORIZED for backward compatibility
    const rejectUnauthorized =
      process.env.NODE_TLS_REJECT_UNAUTHORIZED === "1" ||
      (process.env.TLS_REJECT_UNAUTHORIZED === "1" &&
        process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0");

    // Log TLS configuration using MCP-compatible logger
    logger.tlsConfig(rejectUnauthorized);

    axiosInstance = axios.create({
      httpsAgent: new Agent({
        rejectUnauthorized: rejectUnauthorized,
      }),
    });
  }
  return axiosInstance;
}

// Cleanup function for tests
export function cleanup() {
  if (axiosInstance) {
    // Clear all existing interceptors
    axiosInstance.interceptors.request.clear();
    axiosInstance.interceptors.response.clear();
    
    // Destroy the axios instance
    axiosInstance = null;
  }
  config = undefined;
  csrfToken = null;
  cookies = null;
}

let config: SapConfig | undefined;
let csrfToken: string | null = null;
let cookies: string | null = null; // Variable to store cookies

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

export async function getAuthHeaders() {
  if (!config) {
    config = getConfig();
  }

  // Initialize headers
  const headers: Record<string, string> = {};

  // Add client header if it's available
  if (config.client) {
    headers["X-SAP-Client"] = config.client;
  }

  // Add authentication headers based on auth type
  if (config.authType === "basic" && config.username && config.password) {
    // Basic authentication
    const auth = Buffer.from(`${config.username}:${config.password}`).toString(
      "base64"
    );
    headers["Authorization"] = `Basic ${auth}`;
  } else if (config.authType === "jwt" && config.jwtToken) {
    // JWT Bearer authentication
    headers["Authorization"] = `Bearer ${config.jwtToken}`;
  } else {
    throw new Error("Invalid authentication configuration");
  }

  return headers;
}

/**
 * Fetches a CSRF token from the SAP ABAP system with retry mechanism
 * @param url Base URL to fetch CSRF token from
 * @param retryCount Number of retries (default: 3)
 * @param retryDelay Delay between retries in ms (default: 1000)
 * @returns Promise with the CSRF token string
 */
async function fetchCsrfToken(
  url: string,
  retryCount = 3,
  retryDelay = 1000
): Promise<string> {
  // Use our MCP-compatible logger for CSRF operations

  // Add /sap/bc/adt/discovery path to the URL if not present
  // This is the standard endpoint for obtaining a CSRF token in SAP ABAP systems
  let csrfUrl = url;
  if (!url.includes("/sap/bc/adt/")) {
    csrfUrl = `${url}/sap/bc/adt/discovery`;
  }

  logger.csrfToken("fetch", `Fetching CSRF token from: ${csrfUrl}`);

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      // Only log retry attempts after the first attempt
      if (attempt > 0) {
        logger.csrfToken(
          "retry",
          `Retry attempt ${attempt}/${retryCount} for CSRF token`
        );
      }

      const response = await createAxiosInstance()({
        method: "GET",
        url: csrfUrl,
        headers: {
          ...(await getAuthHeaders()),
          "x-csrf-token": "fetch",
          Accept: "application/atomsvc+xml", // SAP ADT requires this specific Accept header
        },
        // Set a timeout to prevent hanging requests
        timeout: 10000,
      });

      const token = response.headers["x-csrf-token"];
      if (!token) {
        logger.csrfToken("error", "No CSRF token in response headers", {
          headers: response.headers,
          status: response.status,
        });

        if (attempt < retryCount) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue;
        }
        throw new Error("No CSRF token in response headers");
      }

      // Extract and store cookies
      if (response.headers["set-cookie"]) {
        cookies = response.headers["set-cookie"].join("; ");
        logger.csrfToken("success", "Cookies extracted from response", {
          cookieLength: cookies.length,
        });
      }

      logger.csrfToken("success", "CSRF token successfully obtained");
      return token;
    } catch (error) {
      // Output error details for debugging
      if (error instanceof AxiosError) {
        logger.csrfToken("error", `CSRF token error: ${error.message}`, {
          url: csrfUrl,
          status: error.response?.status,
          attempt: attempt + 1,
          maxAttempts: retryCount + 1,
        });

        // If 405 — not a critical error, CSRF token is often still returned (SAP specifics)
        if (
          error.response?.status === 405 &&
          error.response?.headers["x-csrf-token"]
        ) {
          logger.csrfToken(
            "retry",
            "CSRF: SAP returned 405 (Method Not Allowed) — not critical, token found in header"
          );

          const token = error.response.headers["x-csrf-token"];
          if (token) {
            if (error.response.headers["set-cookie"]) {
              cookies = error.response.headers["set-cookie"].join("; ");
            }
            return token;
          }
        }

        // Check response headers for CSRF token even on other errors
        if (error.response?.headers["x-csrf-token"]) {
          logger.csrfToken(
            "success",
            `Got CSRF token despite error (status: ${error.response?.status})`
          );

          const token = error.response.headers["x-csrf-token"];
          if (error.response.headers["set-cookie"]) {
            cookies = error.response.headers["set-cookie"].join("; ");
          }
          return token;
        }

        // Log detailed error information
        if (error.response) {
          logger.csrfToken("error", "CSRF error details", {
            status: error.response.status,
            statusText: error.response.statusText,
            headers: Object.keys(error.response.headers),
            data:
              typeof error.response.data === "string"
                ? error.response.data.slice(0, 200)
                : JSON.stringify(error.response.data).slice(0, 200),
          });
        } else if (error.request) {
          logger.csrfToken(
            "error",
            "CSRF request error - no response received",
            {
              request: error.request.path,
            }
          );
        }
      } else {
        logger.csrfToken("error", "CSRF non-axios error", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // If we haven't exhausted our retries, wait and try again
      if (attempt < retryCount) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }

      // For both basic and JWT, a real CSRF token is still required
      throw new Error(
        `Failed to fetch CSRF token after ${retryCount + 1} attempts: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // This should never happen, but TypeScript requires a return statement
  throw new Error("CSRF token fetch failed unexpectedly");
}

export async function makeAdtRequest(
  url: string,
  method: string,
  timeout: number,
  data?: any,
  params?: any
) {
  // Add correct ADT paths to the URL if not present
  let requestUrl = url;
  if (!url.includes("/sap/bc/adt/") && !url.endsWith("/sap/bc/adt")) {
    if (url.endsWith("/")) {
      requestUrl = `${url}sap/bc/adt`;
    } else {
      requestUrl = `${url}/sap/bc/adt`;
    }
  }

  // For POST/PUT requests, obtain CSRF token
  if (method === "POST" || method === "PUT") {
    try {
      // Always fetch a new CSRF token for writes to ensure it's fresh
      // This helps with compatibility issues between different MCP clients
      csrfToken = await fetchCsrfToken(requestUrl);
    } catch (error) {
      const errorMsg =
        "CSRF token is required for POST/PUT requests but could not be fetched";

      // Log the error using the MCP-compatible logger
      logger.error(errorMsg, {
        type: "CSRF_FETCH_ERROR",
        cause: error instanceof Error ? error.message : String(error),
      });

      throw new Error(errorMsg);
    }
  }

  const requestHeaders = {
    ...(await getAuthHeaders()),
  };

  // Add CSRF token for POST/PUT requests
  if ((method === "POST" || method === "PUT") && csrfToken) {
    requestHeaders["x-csrf-token"] = csrfToken;
  }

  // Add cookies if available
  if (cookies) {
    requestHeaders["Cookie"] = cookies;
  }

  // Add Accept header for ADT requests
  if (!requestHeaders["Accept"]) {
    requestHeaders["Accept"] =
      "application/xml, application/json, text/plain, */*";
  }

  // Add Content-Type for POST/PUT requests with data
  if ((method === "POST" || method === "PUT") && data) {
    if (typeof data === "string" && !requestHeaders["Content-Type"]) {
      // For SQL queries and plain text data
      requestHeaders["Content-Type"] = "text/plain; charset=utf-8";
    }
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

  // Log request info using the MCP-compatible logger
  logger.info(`Executing ${method} request to: ${requestUrl}`, {
    type: "REQUEST_INFO",
    url: requestUrl,
    method: method,
  });

  try {
    const response = await createAxiosInstance()(requestConfig);

    // Log success using the MCP-compatible logger
    logger.info(`Request succeeded with status ${response.status}`, {
      type: "REQUEST_SUCCESS",
      status: response.status,
      url: requestUrl,
      method: method,
    });

    return response;
  } catch (error) {
    // Log error details in JSON format for MCP compatibility
    const errorDetails: {
      type: string;
      message: string;
      url: string;
      method: string;
      status?: number;
      data?: string | undefined;
    } = {
      type: "REQUEST_ERROR",
      message: error instanceof Error ? error.message : String(error),
      url: requestUrl,
      method: method,
      status: error instanceof AxiosError ? error.response?.status : undefined,
      data: undefined,
    };

    if (error instanceof AxiosError && error.response) {
      errorDetails.data =
        typeof error.response.data === "string"
          ? error.response.data.slice(0, 200)
          : JSON.stringify(error.response.data).slice(0, 200);
    }

    // Log error using the MCP-compatible logger
    logger.error(errorDetails.message, errorDetails);

    // If we get CSRF token validation errors (403 forbidden or other status codes containing CSRF error message),
    // try to fetch a new token and retry
    const isCsrfError =
      error instanceof AxiosError &&
      ((error.response?.status === 403 &&
        error.response.data?.includes("CSRF")) ||
        (error.response?.data?.includes("CSRF token") &&
          error.response.data?.includes("invalid")) ||
        error.message.includes("CSRF"));

    if (isCsrfError) {
      // Log CSRF retry using the MCP-compatible logger
      logger.csrfToken(
        "retry",
        "CSRF token validation failed, fetching new token and retrying request",
        {
          url: requestUrl,
          method: method,
        }
      );

      // Fetch new token with increased retry count for critical operations
      csrfToken = await fetchCsrfToken(requestUrl, 5, 2000);
      requestConfig.headers["x-csrf-token"] = csrfToken;

      // Ensure cookies are included in retry
      if (cookies) {
        requestConfig.headers["Cookie"] = cookies;
      }

      // Return the retry attempt
      return await createAxiosInstance()(requestConfig);
    }

    // Re-throw the original error if it wasn't a CSRF issue or retry failed
    throw error;
  }
}
