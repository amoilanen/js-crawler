import * as cheerio from 'cheerio';
import type { HttpResponse } from './types.js';

const BODY_PLACEHOLDER = '<<...non-text content (omitted by js-crawler)...>>';

const TEXT_CONTENT_TYPES = ['text/', 'application/xhtml+xml', 'application/json', 'application/xml'];

export interface LinkExtractionOptions {
  ignoreRelative?: boolean;
  shouldCrawl?: (url: string) => boolean;
  selector?: string;
}

export function isTextContent(response: HttpResponse): boolean {
  const contentType = response.headers['content-type'];
  if (!contentType) return false;
  return TEXT_CONTENT_TYPES.some(prefix => contentType.startsWith(prefix));
}

export function isHtmlContent(response: HttpResponse): boolean {
  const contentType = response.headers['content-type'];
  if (!contentType) return false;
  return contentType.startsWith('text/html') || contentType.startsWith('application/xhtml+xml');
}

export function getEncoding(response: HttpResponse): string {
  const contentType = response.headers['content-type'] ?? '';
  const match = /charset=([^\s;]+)/i.exec(contentType);
  return match ? match[1].toLowerCase() : 'utf-8';
}

export function decodeBody(response: HttpResponse): string {
  if (!isTextContent(response)) {
    return BODY_PLACEHOLDER;
  }

  const encoding = getEncoding(response);
  try {
    const decoder = new TextDecoder(encoding);
    return decoder.decode(response.body);
  } catch {
    return response.body.toString('utf-8');
  }
}

export function getBaseUrl(responseUrl: string, $: cheerio.CheerioAPI): string {
  const baseHref = $('base').attr('href');
  if (!baseHref) return responseUrl;

  try {
    return new URL(baseHref, responseUrl).href;
  } catch {
    return responseUrl;
  }
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function extractUrls(
  response: HttpResponse,
  options: LinkExtractionOptions = {},
): string[] {
  if (!isHtmlContent(response)) {
    return [];
  }

  const { ignoreRelative = false, shouldCrawl, selector } = options;

  const body = decodeBody(response);
  const $ = cheerio.load(body);
  const baseUrl = getBaseUrl(response.url, $);

  const root = selector ? $(selector) : $.root();
  const linkElements = root.find('a[href]');

  const seen = new Set<string>();
  const urls: string[] = [];

  linkElements.each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#')) return;

    if (ignoreRelative && !href.includes('://')) return;

    let resolved: string;
    try {
      resolved = new URL(href, baseUrl).href;
    } catch {
      return;
    }

    if (!isHttpUrl(resolved)) return;
    if (seen.has(resolved)) return;
    seen.add(resolved);

    if (shouldCrawl && !shouldCrawl(resolved)) return;

    urls.push(resolved);
  });

  return urls;
}
