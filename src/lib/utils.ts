import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { Agent } from 'https';
import { AxiosResponse } from 'axios';
import { getConfig, SapConfig } from '../index'; // getConfig needs to be exported from index.ts

export { McpError, ErrorCode, AxiosResponse };

// Hard cap, in UTF-8 BYTES (not JS string/UTF-16 length), on the JSON text
// actually handed back to the MCP host. The host's own limit is token-based
// and code tokenizes less efficiently than prose (short keywords/
// punctuation); JSON.stringify also turns every real newline into an
// escaped two-char "\n" sequence, inflating the serialized size beyond the
// raw source length. Real-world failures have been observed even around
// 60-100k raw chars, so this is kept deliberately small with a wide safety
// margin rather than tuned to a measured cutoff (the host never reports the
// actual limit). Bytes rather than `.length` (UTF-16 code units) because
// ABAP source routinely contains multi-byte UTF-8 characters (accented
// Portuguese/German text in comments and literals is common in this
// codebase's actual usage) - `.length` undercounts those and can let a
// response through that is meaningfully larger, in the bytes the host
// actually measures, than SAFE_OUTPUT_BYTES suggests.
//
// BREAKING CHANGE for consumers: when paging engages - automatically for a
// result that would otherwise exceed this budget, or explicitly via
// startLine/maxLines (or startIndex/maxItems for array results) - the
// response text is no longer the raw source/array. It becomes a JSON object
// `{content, totalLines|totalItems, startLine|startIndex, returnedLines|
// returnedItems, hasMore, ...}` (see buildPagedPayload/buildPagedArrayPayload
// below for the exact shape, including the capped/autoPaged/note/
// truncatedMidLine/truncatedMidItem flags). Callers that previously assumed
// every response is always the raw text/array verbatim must check for this
// shape. Small results (already under SAFE_OUTPUT_BYTES, no paging
// requested) are unaffected and keep returning the original raw shape.
const SAFE_OUTPUT_BYTES = 40_000;

function byteLength(text: string): number {
    return Buffer.byteLength(text, 'utf8');
}

// Trims `text` to at most `maxBytes` UTF-8 bytes without splitting a
// multi-byte character (a plain Buffer byte-slice can cut a UTF-8 sequence
// in half and produce invalid/corrupted text; this cuts on JS string
// character boundaries instead, via binary search on byteLength).
function truncateToByteBudget(text: string, maxBytes: number): string {
    if (byteLength(text) <= maxBytes) {
        return text;
    }
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (byteLength(text.slice(0, mid)) <= maxBytes) {
            lo = mid;
        } else {
            hi = mid - 1;
        }
    }
    return text.slice(0, lo);
}

// Validates an optional paging argument (startLine/maxLines/startIndex/
// maxItems): if provided at all, it must be a finite integer >= min.
// undefined/null means "not specified" and is allowed through as such -
// silently coercing garbage input (non-numeric strings, NaN, negative
// numbers, floats) to a default was the previous behaviour and could mask a
// caller bug (e.g. a typo'd param name landing in the wrong field) instead
// of surfacing it.
function validatePagingArg(value: any, name: string, min: number): number | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }
    const num = Number(value);
    if (!Number.isFinite(num) || !Number.isInteger(num) || num < min) {
        throw new McpError(
            ErrorCode.InvalidParams,
            `${name} must be an integer >= ${min}, got ${JSON.stringify(value)}`
        );
    }
    return num;
}

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

        // Always self-correct against the actual serialized byte size,
        // whether the caller asked for paging or not - an explicit maxLines
        // is a request, not a guarantee we can honour without exceeding the
        // host's limit.
        const size = byteLength(text);
        if (size <= SAFE_OUTPUT_BYTES || maxLines <= 1) {
            break;
        }
        capped = true;
        maxLines = Math.max(1, Math.floor(maxLines * (SAFE_OUTPUT_BYTES / size) * 0.9));
    }

    // Line-based shrinking bottoms out at 1 line: if that single line is
    // itself larger than the safe budget (e.g. minified/no-newline content),
    // fall back to a hard byte-safe cut so the response always fits.
    if (byteLength(text) > SAFE_OUTPUT_BYTES) {
        const singleLine = lines.slice(startIndex, Math.min(startIndex + 1, totalLines)).join('\n');
        const envelopeOverhead = 400; // room for JSON keys/quotes + note text
        const budget = Math.max(1000, SAFE_OUTPUT_BYTES - envelopeOverhead);
        const truncatedLine = truncateToByteBudget(singleLine, budget);
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

// Array counterpart of buildPagedPayload, for handlers whose response is a
// list of items (e.g. GetPackage's flattened member list) rather than
// multi-line text. Same unconditional-shrink + single-item-too-big fallback
// discipline, indexed by item count instead of line count.
function buildPagedArrayPayload(items: any[], totalItems: number, startIndex: number, initialMaxItems: number, requestedPaging: boolean): string {
    let maxItems = initialMaxItems;
    let text = '';
    let endIndex = startIndex;
    let capped = false;

    for (let attempt = 0; attempt < 8; attempt++) {
        endIndex = Math.min(startIndex + maxItems, totalItems);
        const payload: any = {
            content: items.slice(startIndex, endIndex),
            totalItems,
            startIndex,
            returnedItems: Math.max(0, endIndex - startIndex),
            hasMore: endIndex < totalItems
        };
        if (!requestedPaging) {
            payload.autoPaged = true;
        }
        if (capped) {
            payload.capped = true;
            payload.note = 'Requested/default range exceeded the safe response size and was shrunk to fit. Pass a smaller maxItems (or a later startIndex) to continue.';
        }
        text = JSON.stringify(payload);

        const size = byteLength(text);
        if (size <= SAFE_OUTPUT_BYTES || maxItems <= 1) {
            break;
        }
        capped = true;
        maxItems = Math.max(1, Math.floor(maxItems * (SAFE_OUTPUT_BYTES / size) * 0.9));
    }

    // Bottomed out at 1 item and it's still too big (e.g. one member with an
    // unusually long description) - hard-truncate that single item's JSON
    // text as a last resort so the response always fits.
    if (byteLength(text) > SAFE_OUTPUT_BYTES) {
        const singleItemEndIndex = Math.min(startIndex + 1, totalItems);
        const singleItemText = JSON.stringify(items.slice(startIndex, singleItemEndIndex));
        const envelopeOverhead = 400;
        const budget = Math.max(1000, SAFE_OUTPUT_BYTES - envelopeOverhead);
        const truncated = truncateToByteBudget(singleItemText, budget);
        text = JSON.stringify({
            content: truncated,
            totalItems,
            startIndex,
            returnedItems: singleItemEndIndex - startIndex,
            hasMore: true,
            ...(!requestedPaging ? { autoPaged: true } : {}),
            capped: true,
            truncatedMidItem: true,
            note: 'Result exceeded the safe response size even for a single item and was cut mid-item (content is a raw JSON-text prefix, not parseable as JSON on its own). Pass startIndex/maxItems to continue.'
        });
    }

    return text;
}

export function return_response(response: AxiosResponse, args?: { startLine?: any; maxLines?: any; startIndex?: any; maxItems?: any }) {
    const data = response.data;

    if (Array.isArray(data)) {
        const startIndex = validatePagingArg(args?.startIndex, 'startIndex', 0) ?? 0;
        const maxItemsArg = validatePagingArg(args?.maxItems, 'maxItems', 0);
        const requestedPaging = !!args && (args.startIndex !== undefined || args.maxItems !== undefined);
        const totalItems = data.length;

        if (!requestedPaging) {
            const text = JSON.stringify(data);
            if (byteLength(text) <= SAFE_OUTPUT_BYTES) {
                return {
                    isError: false,
                    content: [{ type: 'text', text }]
                };
            }
        }

        const initialMaxItems = maxItemsArg !== undefined ? maxItemsArg : totalItems - startIndex;
        const text = buildPagedArrayPayload(data, totalItems, startIndex, initialMaxItems, requestedPaging);
        return {
            isError: false,
            content: [{ type: 'text', text }]
        };
    }

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

    const startLineArg = validatePagingArg(args?.startLine, 'startLine', 1);
    const maxLinesArg = validatePagingArg(args?.maxLines, 'maxLines', 0);
    const requestedPaging = !!args && (args.startLine !== undefined || args.maxLines !== undefined);

    // Only the very cheapest path (no paging requested, content already
    // small) skips the payload builder entirely.
    if (!requestedPaging && byteLength(data) <= SAFE_OUTPUT_BYTES) {
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
    const startLine = startLineArg ?? 1;
    const startIndex = startLine - 1;
    const initialMaxLines = maxLinesArg !== undefined
        ? maxLinesArg
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
