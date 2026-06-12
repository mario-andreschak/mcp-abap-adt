import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { Agent } from 'https';
import { AxiosResponse } from 'axios';
import { getConfig, SapConfig } from '../index'; // getConfig needs to be exported from index.ts

export { McpError, ErrorCode, AxiosResponse };

export function return_response(response: AxiosResponse) {
    return {
        isError: false,
        content: [{
            type: 'text',
            text: response.data
        }]
    };
}
export function return_error(error: any) {
    return {
        isError: true,
        content: [{
            type: 'text',
            text: `Error: ${error instanceof AxiosError ? String(error.response?.data)
                : error instanceof Error ? error.message
                    : String(error)}`
        }]
    };
}

let axiosInstance: AxiosInstance | null = null;
export function createAxiosInstance() {
    if (!axiosInstance) {
        axiosInstance = axios.create({
            httpsAgent: new Agent({
                rejectUnauthorized: false // Allow self-signed certificates
            })
        });
    }
    return axiosInstance;
}

// Cleanup function for tests
export function cleanup() {
    if (axiosInstance) {
        // Clear any interceptors
        const reqInterceptor = axiosInstance.interceptors.request.use((config) => config);
        const resInterceptor = axiosInstance.interceptors.response.use((response) => response);
        axiosInstance.interceptors.request.eject(reqInterceptor);
        axiosInstance.interceptors.response.eject(resInterceptor);
    }
    axiosInstance = null;
    config = undefined;
    csrfToken = null;
    cookieJar.clear();
}

let config: SapConfig | undefined;
let csrfToken: string | null = null;
// Cookies stored as name -> value map so subsequent Set-Cookie responses MERGE rather than REPLACE.
// A REPLACE loses JSESSIONID when a later response only sets sap-contextid, which breaks the
// stateful LOCK -> PUT -> UNLOCK chain with "Session not found".
const cookieJar: Map<string, string> = new Map();

function cookieHeader(): string | null {
    if (cookieJar.size === 0) return null;
    return Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

function absorbSetCookie(setCookieHeaders: string[] | string | undefined): void {
    if (!setCookieHeaders) return;
    const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (const raw of arr) {
        if (!raw) continue;
        // each header is "name=value; Path=/; HttpOnly; ..." — we only care about name=value
        const semi = raw.indexOf(';');
        const nv = semi >= 0 ? raw.substring(0, semi) : raw;
        const eq = nv.indexOf('=');
        if (eq <= 0) continue;
        const name = nv.substring(0, eq).trim();
        const value = nv.substring(eq + 1).trim();
        if (!name) continue;
        cookieJar.set(name, value);
    }
}

export async function getBaseUrl() {
    if (!config) {
        config = getConfig();
    }
    const { url } = config;
    try {
        const urlObj = new URL(url);
        const baseUrl = Buffer.from(`${urlObj.origin}`);
        return baseUrl;
    } catch (error) {
        const errorMessage = `Invalid URL in configuration: ${error instanceof Error ? error.message : error}`;
        throw new Error(errorMessage);
    }
}

export async function getAuthHeaders() {
    if (!config) {
        config = getConfig();
    }
    const { username, password, client } = config;
    const auth = Buffer.from(`${username}:${password}`).toString('base64'); // Create Basic Auth string
    return {
        'Authorization': `Basic ${auth}`, // Basic Authentication header
        'X-SAP-Client': client            // SAP client header
    };
}

async function fetchCsrfToken(url: string): Promise<string> {
    try {
        const response = await createAxiosInstance()({
            method: 'GET',
            url,
            headers: {
                ...(await getAuthHeaders()),
                'x-csrf-token': 'fetch'
            }
        });

        const token = response.headers['x-csrf-token'];
        if (!token) {
            throw new Error('No CSRF token in response headers');
        }

        // Extract and store cookies
        absorbSetCookie(response.headers['set-cookie']);

        return token;
    } catch (error) {
        // Even if the request fails, try to get token from error response
        if (error instanceof AxiosError && error.response?.headers['x-csrf-token']) {
            const token = error.response.headers['x-csrf-token'];
            if (token) {
                 // Extract and store cookies from the error response as well
                absorbSetCookie(error.response.headers['set-cookie']);
                return token;
            }
        }
        // If we couldn't get token from error response either, throw the original error
        throw new Error(`Failed to fetch CSRF token: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function makeAdtRequest(url: string, method: string, timeout: number, data?: any, params?: any, headers?: any) {
    const isWriteMethod = method === 'POST' || method === 'PUT' || method === 'DELETE';
    // For all write methods, ensure we have a CSRF token
    if (isWriteMethod && !csrfToken) {
        try {
            csrfToken = await fetchCsrfToken(url);
        } catch (error) {
            throw new Error('CSRF token is required for write methods (POST/PUT/DELETE) but could not be fetched');
        }
    }

    const requestHeaders: Record<string, string> = {
        ...(await getAuthHeaders()),
        ...(headers || {}) // caller-supplied headers (e.g. Accept, Content-Type)
    };

    // Add CSRF token for all write methods
    if (isWriteMethod && csrfToken) {
        requestHeaders['x-csrf-token'] = csrfToken;
    }

    // Add cookies if available
    const cookieStr = cookieHeader();
    if (cookieStr) {
        requestHeaders['Cookie'] = cookieStr;
    }

    const config: any = {
        method,
        url,
        headers: requestHeaders,
        timeout,
        params: params
    };

    // Include data in the request configuration if provided
    if (data) {
        config.data = data;
    }

    try {
        const response = await createAxiosInstance()(config);
        // Keep cookies in sync across stateful write flows (LOCK -> PUT -> UNLOCK).
        // Without this, the sap-contextid / JSESSIONID set by the LOCK response is lost
        // and the subsequent PUT fails with "lock handle not found".
        absorbSetCookie(response.headers['set-cookie']);
        return response;
    } catch (error) {
        // If we get a 403 with "CSRF token validation failed", try to fetch a new token and retry
        if (error instanceof AxiosError && error.response?.status === 403 &&
            error.response.data?.includes('CSRF')) {
            csrfToken = await fetchCsrfToken(url);
            config.headers['x-csrf-token'] = csrfToken;
            const retry = await createAxiosInstance()(config);
            absorbSetCookie(retry.headers['set-cookie']);
            return retry;
        }
        throw error;
    }
}

/**
 * Drop stateful session state. Call between unrelated write transactions
 * to force a fresh session and discard any stale lock handles.
 */
export function resetSession() {
    csrfToken = null;
    cookieJar.clear();
}
