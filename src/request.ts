import { request as undiciRequest, type Dispatcher } from 'undici';
import type { HttpResponse } from './types.js';

const MAX_REDIRECTS = 10;
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

class TooManyRedirectsError extends Error {
  constructor(max: number) {
    super(`Too many redirects (max ${max})`);
    this.name = 'TooManyRedirectsError';
  }
}

export interface RequestOptions {
  url: string;
  referer: string;
  userAgent: string;
  headers?: Record<string, string>;
  requestTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  signal?: AbortSignal;
  dispatcher?: Dispatcher;
}

export async function makeRequest(options: RequestOptions): Promise<HttpResponse> {
  const {
    url,
    referer,
    userAgent,
    headers = {},
    requestTimeout = 30000,
    maxRetries = 2,
    retryDelay = 1000,
    signal,
    dispatcher,
  } = options;

  const mergedHeaders: Record<string, string> = {
    'User-Agent': userAgent,
    Referer: referer,
    ...headers,
  };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }

    try {
      return await requestWithRedirects(url, mergedHeaders, requestTimeout, signal, dispatcher);
    } catch (err) {
      lastError = err as Error;

      if ((err as Error).name === 'AbortError' || err instanceof TooManyRedirectsError) {
        throw err;
      }

      if (attempt < maxRetries) {
        await delay(retryDelay, signal);
      }
    }
  }

  throw lastError!;
}

async function requestWithRedirects(
  url: string,
  headers: Record<string, string>,
  timeout: number,
  signal?: AbortSignal,
  dispatcher?: Dispatcher,
): Promise<HttpResponse> {
  const redirectUrls: string[] = [];
  let currentUrl = url;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const timeoutSignal = AbortSignal.timeout(timeout);
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;

    const response = await undiciRequest(currentUrl, {
      method: 'GET',
      headers,
      maxRedirections: 0,
      signal: combinedSignal,
      throwOnError: false,
      ...(dispatcher ? { dispatcher } : {}),
    });

    if (REDIRECT_STATUS_CODES.has(response.statusCode)) {
      const location = response.headers.location as string | undefined;
      // Consume the body to free resources
      await response.body.text();

      if (!location) {
        return {
          headers: flattenHeaders(response.headers),
          body: Buffer.alloc(0),
          statusCode: response.statusCode,
          url: currentUrl,
          redirectUrls,
        };
      }

      redirectUrls.push(currentUrl);
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    const body = Buffer.from(await response.body.arrayBuffer());

    return {
      headers: flattenHeaders(response.headers),
      body,
      statusCode: response.statusCode,
      url: currentUrl,
      redirectUrls,
    };
  }

  throw new TooManyRedirectsError(MAX_REDIRECTS);
}

function flattenHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    result[key] = Array.isArray(value) ? value.join(', ') : value;
  }
  return result;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }

    const timer = setTimeout(resolve, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    }, { once: true });
  });
}
