import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { Agent } from 'https';
import { AxiosResponse } from 'axios';
import { getConfig, SapConfig } from '../index'; // getConfig needs to be exported from index.ts

export { McpError, ErrorCode, AxiosResponse };

// Hard cap (chars) on the JSON text actually handed back to the MCP host.
// The host's own limit is token-based and code tokenizes less efficiently
// than prose (short keywords/punctuation); JSON.stringify also turns every
// real newline into an escaped two-char "\n" sequence, inflating the
// serialized size beyond the raw source length. Real-world failures have
// been observed even around 60-100k raw chars, so this is kept deliberately
// small with a wide safety margin rather than tuned to a measured cutoff
// (the host never reports the actual limit). This target is enforced
// UNCONDITIONALLY against the FINAL serialized payload — including when the
// caller passes an explicit startLine/maxLines that would itself produce a
// too-large response, since honouring an oversized explicit request is just
// as broken as not paging an oversized default.
const SAFE_OUTPUT_CHARS = 40_000;

function buildPagedPayload(lines: string[], totalLines: number, startLine: number, initialMaxLines: number, requestedPaging: boolean): string {
    const startIndex = startLine - 1;
    let maxLines = initialMaxLines;
    let text = '';
    let endIndex = startIndex;
    let capped = false;

    for (let attempt = 0; attempt < 8; attempt++) {
        endIndex = Math.min(startIndex + maxLines, totalLines);
        const pagedText = lines.slice(startIndex, endIndex).join('\n');
        const payload: any = {
            content: pagedText,
            totalLines,
            startLine,
            returnedLines: Math.max(0, endIndex - startIndex),
            hasMore: endIndex < totalLines
        };
        if (!requestedPaging) {
            payload.autoPaged = true;
        }
        if (capped) {
            payload.capped = true;
            payload.note = 'Requested/default range exceeded the safe response size and was shrunk to fit. Pass a smaller maxLines (or a later startLine) to continue.';
        }
        text = JSON.stringify(payload);

        // Always self-correct against the actual serialized size, whether the
        // caller asked for paging or not - an explicit maxLines is a request,
        // not a guarantee we can honour without exceeding the host's limit.
        if (text.length <= SAFE_OUTPUT_CHARS || maxLines <= 1) {
            break;
        }
        capped = true;
        maxLines = Math.max(1, Math.floor(maxLines * (SAFE_OUTPUT_CHARS / text.length) * 0.9));
    }

    // Line-based shrinking bottoms out at 1 line: if that single line is
    // itself larger than the safe budget (e.g. minified/no-newline content),
    // fall back to a hard character cut so the response always fits.
    if (text.length > SAFE_OUTPUT_CHARS) {
        const singleLine = lines.slice(startIndex, Math.min(startIndex + 1, totalLines)).join('\n');
        const envelopeOverhead = 400; // room for JSON keys/quotes + note text
        const budget = Math.max(1000, SAFE_OUTPUT_CHARS - envelopeOverhead);
        const truncatedLine = singleLine.length > budget ? singleLine.slice(0, budget) : singleLine;
        text = JSON.stringify({
            content: truncatedLine,
            totalLines,
            startLine,
            returnedLines: 1,
            hasMore: endIndex < totalLines || truncatedLine.length < singleLine.length,
            ...(!requestedPaging ? { autoPaged: true } : {}),
            capped: true,
            truncatedMidLine: truncatedLine.length < singleLine.length,
            note: 'Result exceeded the safe response size even for a single line and was cut mid-line. Pass startLine/maxLines (or a character-oriented approach) to continue.'
        });
    }

    return text;
}

export function return_response(response: AxiosResponse, args?: { startLine?: any; maxLines?: any }) {
    const data = response.data;

    if (typeof data !== 'string') {
        // e.g. GetTableContents already returns structured data.
        return {
            isError: false,
            content: [{
                type: 'text',
                text: data
            }]
        };
    }

    const requestedPaging = !!args && (args.startLine !== undefined || args.maxLines !== undefined);

    // Only the very cheapest path (no paging requested, content already
    // small) skips the payload builder entirely.
    if (!requestedPaging && data.length <= SAFE_OUTPUT_CHARS) {
        return {
            isError: false,
            content: [{
                type: 'text',
                text: data
            }]
        };
    }

    const lines = data.split('\n');
    const totalLines = lines.length;
    const startLine = Math.max(1, Number(args?.startLine) || 1);
    const startIndex = startLine - 1;
    const initialMaxLines = args?.maxLines !== undefined
        ? Math.max(0, Number(args.maxLines))
        : totalLines - startIndex;

    const text = buildPagedPayload(lines, totalLines, startLine, initialMaxLines, requestedPaging);

    return {
        isError: false,
        content: [{
            type: 'text',
            text
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
    if (!config) {
        config = getConfig();
    }
    try {
        const response = await createAxiosInstance()({
            method: 'GET',
            url,
            // sap-client must be a query parameter; ICF ignores the X-SAP-Client header,
            // so without it the session would be opened in the system default client
            params: { 'sap-client': config.client },
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
        if (response.headers['set-cookie']) {
            cookies = response.headers['set-cookie'].join('; ');
        }

        return token;
    } catch (error) {
        // Even if the request fails, try to get token from error response
        if (error instanceof AxiosError && error.response?.headers['x-csrf-token']) {
            const token = error.response.headers['x-csrf-token'];
            if (token) {
                 // Extract and store cookies from the error response as well
                if (error.response.headers['set-cookie']) {
                    cookies = error.response.headers['set-cookie'].join('; ');
                }
                return token;
            }
        }
        // If we couldn't get token from error response either, throw the original error
        throw new Error(`Failed to fetch CSRF token: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function makeAdtRequest(url: string, method: string, timeout: number, data?: any, params?: any, headers?: any) {
    if (!config) {
        config = getConfig();
    }

    // For POST/PUT requests, ensure we have a CSRF token
    if ((method === 'POST' || method === 'PUT') && !csrfToken) {
        try {
            csrfToken = await fetchCsrfToken(url);
        } catch (error) {
            throw new Error('CSRF token is required for POST/PUT requests but could not be fetched');
        }
    }

    const requestHeaders = {
        ...(await getAuthHeaders()),
        ...(headers || {})
    };

    // Add CSRF token for POST/PUT requests
    if ((method === 'POST' || method === 'PUT') && csrfToken) {
        requestHeaders['x-csrf-token'] = csrfToken;
    }

    // Add cookies if available
    if (cookies) {
        requestHeaders['Cookie'] = cookies;
    }

    const requestConfig: any = {
        method,
        url,
        headers: requestHeaders,
        timeout,
        // sap-client must be a query parameter on every request; ICF ignores the
        // X-SAP-Client header and would otherwise log on to the system default client
        params: { 'sap-client': config.client, ...(params || {}) }
    };

    // Include data in the request configuration if provided
    if (data) {
        requestConfig.data = data;
    }

    try {
        const response = await createAxiosInstance()(requestConfig);
        return response;
    } catch (error) {
        // If we get a 403 with "CSRF token validation failed", try to fetch a new token and retry
        if (error instanceof AxiosError && error.response?.status === 403 &&
            error.response.data?.includes('CSRF')) {
            csrfToken = await fetchCsrfToken(url);
            requestConfig.headers['x-csrf-token'] = csrfToken;
            return await createAxiosInstance()(requestConfig);
        }
        throw error;
    }
}
