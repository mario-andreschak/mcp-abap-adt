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
  } else if (config.authType === "xsuaa" && config.jwtToken) {
    // XSUAA JWT Bearer authentication
    headers["Authorization"] = `Bearer ${config.jwtToken}`;
  } else {
    throw new Error("Invalid authentication configuration");
  }

  return headers;
}

async function fetchCsrfToken(url: string): Promise<string> {
  try {
    // Add /sap/bc/adt/discovery path to the URL if not present
    // This is the standard endpoint for obtaining a CSRF token in SAP ABAP systems
    let csrfUrl = url;
    if (!url.includes("/sap/bc/adt/")) {
      csrfUrl = `${url}/sap/bc/adt/discovery`;
    }

    if (process.env.DEBUG === "true") {
      console.log(`Fetching CSRF token from: ${csrfUrl}`);
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
    // Output error details for debugging
    if (error instanceof AxiosError) {
      if (process.env.DEBUG === "true") {
        console.error(`CSRF token error: ${error.message}`);
        if (error.response) {
          console.error(`Status: ${error.response.status}`);
          console.error(`Headers: ${JSON.stringify(error.response.headers)}`);
          console.error(`Data: ${error.response.data?.slice(0, 200)}...`);
        }
      }
      // If 405 — not a critical error, CSRF token is often still returned (SAP specifics)
      if (
        error.response?.status === 405 &&
        error.response?.headers["x-csrf-token"]
      ) {
        if (process.env.DEBUG === "true") {
          console.warn(
            "CSRF: SAP returned 405 (Method Not Allowed) — not critical, token may be in the header."
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
      // Check response headers for CSRF token even on other errors
      if (error.response?.headers["x-csrf-token"]) {
        const token = error.response.headers["x-csrf-token"];
        if (error.response.headers["set-cookie"]) {
          cookies = error.response.headers["set-cookie"].join("; ");
        }
        return token;
      }
    }

    // For both basic and JWT, a real CSRF token is still required
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
  if ((method === "POST" || method === "PUT") && !csrfToken) {
    try {
      csrfToken = await fetchCsrfToken(requestUrl);
    } catch (error) {
      throw new Error(
        "CSRF token is required for POST/PUT requests but could not be fetched"
      );
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

  console.log(`Executing request to: ${requestUrl} (method: ${method})`);

  try {
    const response = await createAxiosInstance()(requestConfig);
    return response;
  } catch (error) {
    // Log error details
    if (error instanceof AxiosError) {
      console.error(`Request error: ${error.message}`);
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(
          `Data: ${
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
