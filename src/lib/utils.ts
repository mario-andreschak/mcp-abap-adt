import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { Agent } from 'https';
import { AxiosResponse } from 'axios';
import { getConfig, SapConfig } from '../index';

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
    let message: string;
    if (error instanceof AxiosError) {
        message = error.response?.data
            ? String(error.response.data)
            : `${error.message} (${error.code ?? 'no code'})`;
    } else if (error instanceof Error) {
        message = error.message;
    } else {
        message = String(error);
    }
    return {
        isError: true,
        content: [{
            type: 'text',
            text: `Error: ${message}`
        }]
    };
}

let axiosInstance: AxiosInstance | null = null;
export function createAxiosInstance() {
    if (!axiosInstance) {
        axiosInstance = axios.create({
            httpsAgent: new Agent({
                rejectUnauthorized: false
            })
        });
    }
    return axiosInstance;
}

// Per-system caches
const configCache = new Map<string, SapConfig>();
const csrfTokenCache = new Map<string, string>();
const cookiesCache = new Map<string, string>();

export function cleanup() {
    if (axiosInstance) {
        const reqInterceptor = axiosInstance.interceptors.request.use((config) => config);
        const resInterceptor = axiosInstance.interceptors.response.use((response) => response);
        axiosInstance.interceptors.request.eject(reqInterceptor);
        axiosInstance.interceptors.response.eject(resInterceptor);
    }
    axiosInstance = null;
    configCache.clear();
    csrfTokenCache.clear();
    cookiesCache.clear();
}

function getSystemConfig(system: string = 'S4H'): SapConfig {
    const key = system.toUpperCase();
    if (!configCache.has(key)) {
        configCache.set(key, getConfig(key));
    }
    return configCache.get(key)!;
}

export async function getBaseUrl(system: string = 'S4H') {
    const { url } = getSystemConfig(system);
    try {
        const urlObj = new URL(url);
        return urlObj.origin;
    } catch (error) {
        throw new Error(`Invalid URL in configuration: ${error instanceof Error ? error.message : error}`);
    }
}

export async function getAuthHeaders(system: string = 'S4H') {
    const { username, password, client } = getSystemConfig(system);
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    return {
        'Authorization': `Basic ${auth}`,
        'X-SAP-Client': client
    };
}

async function fetchCsrfToken(url: string, system: string): Promise<string> {
    try {
        const response = await createAxiosInstance()({
            method: 'GET',
            url,
            headers: {
                ...(await getAuthHeaders(system)),
                'x-csrf-token': 'fetch'
            }
        });

        const token = response.headers['x-csrf-token'];
        if (!token) {
            throw new Error('No CSRF token in response headers');
        }

        if (response.headers['set-cookie']) {
            cookiesCache.set(system.toUpperCase(), response.headers['set-cookie'].join('; '));
        }

        return token;
    } catch (error) {
        if (error instanceof AxiosError && error.response?.headers['x-csrf-token']) {
            const token = error.response.headers['x-csrf-token'];
            if (token) {
                if (error.response.headers['set-cookie']) {
                    cookiesCache.set(system.toUpperCase(), error.response.headers['set-cookie'].join('; '));
                }
                return token;
            }
        }
        throw new Error(`Failed to fetch CSRF token: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function makeAdtRequest(url: string, method: string, timeout: number, data?: any, params?: any, system: string = 'S4H') {
    const sysKey = system.toUpperCase();

    if ((method === 'POST' || method === 'PUT') && !csrfTokenCache.has(sysKey)) {
        try {
            csrfTokenCache.set(sysKey, await fetchCsrfToken(url, system));
        } catch (error) {
            throw new Error('CSRF token is required for POST/PUT requests but could not be fetched');
        }
    }

    const requestHeaders: any = {
        ...(await getAuthHeaders(system)),
        'Accept': 'text/plain, */*'
    };

    if ((method === 'POST' || method === 'PUT') && csrfTokenCache.has(sysKey)) {
        requestHeaders['x-csrf-token'] = csrfTokenCache.get(sysKey);
    }

    if (cookiesCache.has(sysKey)) {
        requestHeaders['Cookie'] = cookiesCache.get(sysKey);
    }

    const reqConfig: any = {
        method,
        url,
        headers: requestHeaders,
        timeout,
        params: params
    };

    if (data) {
        reqConfig.data = data;
    }

    try {
        const response = await createAxiosInstance()(reqConfig);
        return response;
    } catch (error) {
        if (error instanceof AxiosError && error.response?.status === 403 &&
            error.response.data?.includes('CSRF')) {
            const newToken = await fetchCsrfToken(url, system);
            csrfTokenCache.set(sysKey, newToken);
            reqConfig.headers['x-csrf-token'] = newToken;
            return await createAxiosInstance()(reqConfig);
        }
        throw error;
    }
}
