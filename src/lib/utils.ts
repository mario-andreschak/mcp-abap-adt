import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { Agent } from 'https';
import { AxiosResponse } from 'axios';
import { getConfig, SapConfig } from '../config';

export { McpError, ErrorCode, AxiosResponse };

// MCP hosts commonly apply token-based output limits. A conservative UTF-8
// byte budget leaves room for MCP framing while still guaranteeing that the
// text placed in content[0].text is bounded after JSON serialization.
export const SAFE_OUTPUT_BYTES = 40_000;
export const MAX_PAGE_LINES = 100_000;

export interface PagingArguments {
    startLine?: unknown;
    maxLines?: unknown;
}

interface NormalizedPaging {
    requested: boolean;
    startLine: number;
    maxLines?: number;
}

interface PagedPayload {
    content: string;
    totalLines: number;
    startLine: number;
    returnedLines: number;
    hasMore: boolean;
    autoPaged?: true;
    capped?: true;
    truncatedMidLine?: true;
    note?: string;
}

const CAPPED_NOTE = 'Requested/default range exceeded the safe UTF-8 response budget and was shrunk to fit. Continue with startLine plus returnedLines.';
const MID_LINE_NOTE = 'A single line exceeded the safe UTF-8 response budget, so content contains only its prefix. The omitted remainder cannot be recovered by line pagination; continue at startLine + 1 only when hasMore is true.';

function byteLength(value: string): number {
    return Buffer.byteLength(value, 'utf8');
}

function serializeResponseData(data: unknown, pagingRequested: boolean): string {
    if (typeof data === 'string') {
        return data;
    }

    const serialized = JSON.stringify(data);
    if (serialized === undefined) {
        return String(data);
    }

    // Keep the legacy compact JSON for small, unpaged structured responses.
    // Pretty-print only when paging is explicit or the compact value already
    // exceeds the cap, giving the line pager useful continuation boundaries.
    if (pagingRequested || byteLength(serialized) > SAFE_OUTPUT_BYTES) {
        return JSON.stringify(data, null, 2) ?? serialized;
    }
    return serialized;
}

function normalizePagingArguments(args?: PagingArguments): NormalizedPaging {
    const requested = args?.startLine !== undefined || args?.maxLines !== undefined;
    const startLine = args?.startLine === undefined ? 1 : args.startLine;

    if (typeof startLine !== 'number' || !Number.isFinite(startLine) || !Number.isSafeInteger(startLine) || startLine < 1) {
        throw new McpError(ErrorCode.InvalidParams, 'startLine must be a finite integer greater than or equal to 1');
    }

    if (args?.maxLines === undefined) {
        return { requested, startLine };
    }

    const maxLines = args.maxLines;
    if (typeof maxLines !== 'number' || !Number.isFinite(maxLines) || !Number.isSafeInteger(maxLines) || maxLines < 1 || maxLines > MAX_PAGE_LINES) {
        throw new McpError(ErrorCode.InvalidParams, `maxLines must be a finite integer between 1 and ${MAX_PAGE_LINES}`);
    }

    return { requested, startLine, maxLines };
}

function makePayload(
    lines: string[],
    totalLines: number,
    startLine: number,
    returnedLines: number,
    requestedPaging: boolean,
    capped: boolean
): PagedPayload {
    const startIndex = startLine - 1;
    const endIndex = Math.min(startIndex + returnedLines, totalLines);
    return {
        content: lines.slice(startIndex, endIndex).join('\n'),
        totalLines,
        startLine,
        returnedLines: Math.max(0, endIndex - startIndex),
        hasMore: endIndex < totalLines,
        ...(!requestedPaging ? { autoPaged: true as const } : {}),
        ...(capped ? { capped: true as const, note: CAPPED_NOTE } : {})
    };
}

function serializePayload(payload: PagedPayload): string {
    return JSON.stringify(payload);
}

function sliceWithoutSplittingSurrogatePair(value: string, end: number): string {
    let safeEnd = Math.max(0, Math.min(end, value.length));
    if (safeEnd > 0 && safeEnd < value.length) {
        const previous = value.charCodeAt(safeEnd - 1);
        const next = value.charCodeAt(safeEnd);
        if (previous >= 0xD800 && previous <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF) {
            safeEnd--;
        }
    }
    return value.slice(0, safeEnd);
}

function truncateOversizedLine(
    lines: string[],
    totalLines: number,
    startLine: number,
    requestedPaging: boolean
): string {
    const startIndex = startLine - 1;
    const fullLine = lines[startIndex] ?? '';
    let low = 0;
    let high = fullLine.length;
    let best = '';

    while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const content = sliceWithoutSplittingSurrogatePair(fullLine, middle);
        const payload: PagedPayload = {
            content,
            totalLines,
            startLine,
            // The truncated source line is considered consumed. Any omitted
            // suffix is intentionally unrecoverable through line-based paging.
            returnedLines: 1,
            hasMore: startIndex + 1 < totalLines,
            ...(!requestedPaging ? { autoPaged: true as const } : {}),
            capped: true,
            truncatedMidLine: true,
            note: MID_LINE_NOTE
        };
        const serialized = serializePayload(payload);

        if (byteLength(serialized) <= SAFE_OUTPUT_BYTES) {
            best = serialized;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }

    if (!best || byteLength(best) > SAFE_OUTPUT_BYTES) {
        throw new Error('The pagination metadata exceeds the configured safe output budget');
    }
    return best;
}

function buildPagedPayload(
    lines: string[],
    totalLines: number,
    startLine: number,
    maxLines: number,
    requestedPaging: boolean
): string {
    const startIndex = startLine - 1;
    const availableLines = Math.max(0, totalLines - startIndex);
    const requestedLines = Math.min(maxLines, availableLines);
    const initial = serializePayload(makePayload(
        lines,
        totalLines,
        startLine,
        requestedLines,
        requestedPaging,
        false
    ));

    if (byteLength(initial) <= SAFE_OUTPUT_BYTES) {
        return initial;
    }

    let low = 0;
    let high = requestedLines;
    let best = '';
    let bestLines = 0;

    while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const serialized = serializePayload(makePayload(
            lines,
            totalLines,
            startLine,
            middle,
            requestedPaging,
            true
        ));

        if (byteLength(serialized) <= SAFE_OUTPUT_BYTES) {
            best = serialized;
            bestLines = middle;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }

    if (bestLines > 0 || requestedLines === 0) {
        return best;
    }
    return truncateOversizedLine(lines, totalLines, startLine, requestedPaging);
}

export function return_text_response(data: unknown, args?: PagingArguments) {
    try {
        const paging = normalizePagingArguments(args);
        const textData = serializeResponseData(data, paging.requested);

        // Preserve the legacy response exactly when no paging was requested and
        // the raw/serialized text already fits the conservative byte budget.
        if (!paging.requested && byteLength(textData) <= SAFE_OUTPUT_BYTES) {
            return {
                isError: false,
                content: [{
                    type: 'text',
                    text: textData
                }]
            };
        }

        const lines = textData.split('\n');
        const totalLines = lines.length;
        const startIndex = paging.startLine - 1;
        const maxLines = paging.maxLines ?? Math.max(0, totalLines - startIndex);
        const text = buildPagedPayload(
            lines,
            totalLines,
            paging.startLine,
            maxLines,
            paging.requested
        );

        return {
            isError: false,
            content: [{
                type: 'text',
                text
            }]
        };
    } catch (error) {
        return return_error(error);
    }
}

export function return_response(response: AxiosResponse, args?: PagingArguments) {
    return return_text_response(response.data, args);
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
