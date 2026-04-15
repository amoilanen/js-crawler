import { describe, it, expect } from 'vitest';
import type { HttpResponse } from '../src/types.js';
import {
  isTextContent,
  isHtmlContent,
  getEncoding,
  decodeBody,
  getBaseUrl,
  extractUrls,
} from '../src/response.js';
import * as cheerio from 'cheerio';

function makeResponse(overrides: Partial<HttpResponse> & { bodyStr?: string } = {}): HttpResponse {
  const { bodyStr, ...rest } = overrides;
  return {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: Buffer.from(bodyStr ?? '<html></html>'),
    statusCode: 200,
    url: 'http://example.com/page',
    redirectUrls: [],
    ...rest,
  };
}

function htmlResponse(bodyStr: string, url = 'http://example.com/page'): HttpResponse {
  return makeResponse({ bodyStr, url });
}

describe('isTextContent', () => {
  it('returns true for text/html', () => {
    expect(isTextContent(makeResponse())).toBe(true);
  });

  it('returns true for application/xhtml+xml', () => {
    expect(isTextContent(makeResponse({ headers: { 'content-type': 'application/xhtml+xml' } }))).toBe(true);
  });

  it('returns true for application/json', () => {
    expect(isTextContent(makeResponse({ headers: { 'content-type': 'application/json' } }))).toBe(true);
  });

  it('returns false for image/png', () => {
    expect(isTextContent(makeResponse({ headers: { 'content-type': 'image/png' } }))).toBe(false);
  });

  it('returns false for application/octet-stream', () => {
    expect(isTextContent(makeResponse({ headers: { 'content-type': 'application/octet-stream' } }))).toBe(false);
  });

  it('returns false when no content-type header', () => {
    expect(isTextContent(makeResponse({ headers: {} }))).toBe(false);
  });
});

describe('isHtmlContent', () => {
  it('returns true for text/html', () => {
    expect(isHtmlContent(makeResponse())).toBe(true);
  });

  it('returns true for text/html with charset', () => {
    expect(isHtmlContent(makeResponse({ headers: { 'content-type': 'text/html; charset=utf-8' } }))).toBe(true);
  });

  it('returns true for application/xhtml+xml', () => {
    expect(isHtmlContent(makeResponse({ headers: { 'content-type': 'application/xhtml+xml' } }))).toBe(true);
  });

  it('returns false for text/plain', () => {
    expect(isHtmlContent(makeResponse({ headers: { 'content-type': 'text/plain' } }))).toBe(false);
  });

  it('returns false for application/json', () => {
    expect(isHtmlContent(makeResponse({ headers: { 'content-type': 'application/json' } }))).toBe(false);
  });

  it('returns false when no content-type', () => {
    expect(isHtmlContent(makeResponse({ headers: {} }))).toBe(false);
  });
});

describe('getEncoding', () => {
  it('extracts charset from content-type', () => {
    expect(getEncoding(makeResponse({ headers: { 'content-type': 'text/html; charset=iso-8859-1' } }))).toBe('iso-8859-1');
  });

  it('returns utf-8 as default', () => {
    expect(getEncoding(makeResponse({ headers: { 'content-type': 'text/html' } }))).toBe('utf-8');
  });

  it('returns utf-8 when no content-type header', () => {
    expect(getEncoding(makeResponse({ headers: {} }))).toBe('utf-8');
  });

  it('handles uppercase charset', () => {
    expect(getEncoding(makeResponse({ headers: { 'content-type': 'text/html; Charset=UTF-8' } }))).toBe('utf-8');
  });
});

describe('decodeBody', () => {
  it('decodes utf-8 body', () => {
    const body = decodeBody(htmlResponse('<p>Hello</p>'));
    expect(body).toBe('<p>Hello</p>');
  });

  it('returns placeholder for non-text content', () => {
    const resp = makeResponse({ headers: { 'content-type': 'image/png' } });
    expect(decodeBody(resp)).toBe('<<...non-text content (omitted by js-crawler)...>>');
  });

  it('falls back to utf-8 for unknown encoding', () => {
    const resp = makeResponse({
      headers: { 'content-type': 'text/html; charset=fake-encoding-xyz' },
      bodyStr: '<p>Hello</p>',
    });
    const body = decodeBody(resp);
    expect(body).toBe('<p>Hello</p>');
  });
});

describe('getBaseUrl', () => {
  it('returns response URL when no base tag', () => {
    const $ = cheerio.load('<html><body></body></html>');
    expect(getBaseUrl('http://example.com/page', $)).toBe('http://example.com/page');
  });

  it('resolves base tag against response URL', () => {
    const $ = cheerio.load('<html><head><base href="/other/"></head><body></body></html>');
    expect(getBaseUrl('http://example.com/page', $)).toBe('http://example.com/other/');
  });

  it('handles absolute base href', () => {
    const $ = cheerio.load('<html><head><base href="http://other.com/"></head><body></body></html>');
    expect(getBaseUrl('http://example.com/page', $)).toBe('http://other.com/');
  });

  it('ignores truly invalid base href', () => {
    const $ = cheerio.load('<html><head><base href="http://[invalid"></head><body></body></html>');
    expect(getBaseUrl('http://example.com/page', $)).toBe('http://example.com/page');
  });
});

describe('extractUrls', () => {
  it('extracts links from HTML', () => {
    const resp = htmlResponse(`
      <html><body>
        <a href="http://example.com/a">A</a>
        <a href="http://example.com/b">B</a>
      </body></html>
    `);
    const urls = extractUrls(resp);
    expect(urls).toEqual(['http://example.com/a', 'http://example.com/b']);
  });

  it('resolves relative URLs', () => {
    const resp = htmlResponse(`
      <html><body>
        <a href="/about">About</a>
        <a href="contact">Contact</a>
      </body></html>
    `, 'http://example.com/page/');
    const urls = extractUrls(resp);
    expect(urls).toEqual([
      'http://example.com/about',
      'http://example.com/page/contact',
    ]);
  });

  it('uses base tag for resolution', () => {
    const resp = htmlResponse(`
      <html>
      <head><base href="http://base.com/dir/"></head>
      <body><a href="page.html">Link</a></body>
      </html>
    `);
    const urls = extractUrls(resp);
    expect(urls).toEqual(['http://base.com/dir/page.html']);
  });

  it('deduplicates URLs', () => {
    const resp = htmlResponse(`
      <html><body>
        <a href="http://example.com/a">A1</a>
        <a href="http://example.com/a">A2</a>
      </body></html>
    `);
    const urls = extractUrls(resp);
    expect(urls).toEqual(['http://example.com/a']);
  });

  it('filters non-HTTP protocols', () => {
    const resp = htmlResponse(`
      <html><body>
        <a href="http://example.com/a">HTTP</a>
        <a href="ftp://example.com/b">FTP</a>
        <a href="mailto:test@example.com">Mail</a>
        <a href="javascript:void(0)">JS</a>
        <a href="https://example.com/c">HTTPS</a>
      </body></html>
    `);
    const urls = extractUrls(resp);
    expect(urls).toEqual(['http://example.com/a', 'https://example.com/c']);
  });

  it('skips fragment-only links', () => {
    const resp = htmlResponse(`
      <html><body>
        <a href="#section">Section</a>
        <a href="http://example.com/a">A</a>
      </body></html>
    `);
    const urls = extractUrls(resp);
    expect(urls).toEqual(['http://example.com/a']);
  });

  it('returns empty for non-HTML content', () => {
    const resp = makeResponse({ headers: { 'content-type': 'image/png' } });
    expect(extractUrls(resp)).toEqual([]);
  });

  it('returns empty for empty body', () => {
    const resp = htmlResponse('');
    expect(extractUrls(resp)).toEqual([]);
  });

  it('returns empty for HTML with no links', () => {
    const resp = htmlResponse('<html><body><p>No links here</p></body></html>');
    expect(extractUrls(resp)).toEqual([]);
  });

  it('handles malformed HTML', () => {
    const resp = htmlResponse(`
      <html><body>
        <a href="http://example.com/a">unclosed
        <div><a href="http://example.com/b">nested</a>
      </body></html>
    `);
    const urls = extractUrls(resp);
    expect(urls).toEqual(['http://example.com/a', 'http://example.com/b']);
  });

  it('ignores links inside HTML comments', () => {
    const resp = htmlResponse(`
      <html><body>
        <!-- <a href="http://example.com/hidden">Hidden</a> -->
        <a href="http://example.com/visible">Visible</a>
      </body></html>
    `);
    const urls = extractUrls(resp);
    expect(urls).toEqual(['http://example.com/visible']);
  });

  it('skips anchors without href', () => {
    const resp = htmlResponse(`
      <html><body>
        <a name="anchor">No href</a>
        <a href="http://example.com/a">Has href</a>
      </body></html>
    `);
    const urls = extractUrls(resp);
    expect(urls).toEqual(['http://example.com/a']);
  });

  it('handles invalid href gracefully', () => {
    const resp = htmlResponse(`
      <html><body>
        <a href="http://example.com/a">Good</a>
        <a href="http://[invalid">Bad</a>
      </body></html>
    `);
    const urls = extractUrls(resp);
    expect(urls).toEqual(['http://example.com/a']);
  });

  it('works with single and double quoted attribute values', () => {
    const resp = htmlResponse(
      '<html><body><a href="http://doublequoted.org"></a>' +
      "<a href='http://singlequoted.org'></a></body></html>"
    );
    const urls = extractUrls(resp);
    expect(urls).toEqual(['http://doublequoted.org/', 'http://singlequoted.org/']);
  });

  describe('ignoreRelative option', () => {
    it('filters relative links when ignoreRelative is true', () => {
      const resp = htmlResponse(`
        <html><body>
          <a href="http://example.com/a">Absolute</a>
          <a href="/relative">Relative</a>
          <a href="also-relative">Also Relative</a>
        </body></html>
      `);
      const urls = extractUrls(resp, { ignoreRelative: true });
      expect(urls).toEqual(['http://example.com/a']);
    });

    it('includes relative links when ignoreRelative is false', () => {
      const resp = htmlResponse(`
        <html><body>
          <a href="http://example.com/a">Absolute</a>
          <a href="/relative">Relative</a>
        </body></html>
      `);
      const urls = extractUrls(resp, { ignoreRelative: false });
      expect(urls).toEqual(['http://example.com/a', 'http://example.com/relative']);
    });
  });

  describe('shouldCrawl option', () => {
    it('filters URLs with shouldCrawl callback', () => {
      const resp = htmlResponse(`
        <html><body>
          <a href="http://example.com/a">A</a>
          <a href="http://example.com/b">B</a>
          <a href="http://other.com/c">C</a>
        </body></html>
      `);
      const urls = extractUrls(resp, {
        shouldCrawl: (url) => url.includes('example.com'),
      });
      expect(urls).toEqual(['http://example.com/a', 'http://example.com/b']);
    });

    it('filters even-numbered resource ids', () => {
      const resp = htmlResponse(`
        <html><body>
          <a href="/resource/1"></a>
          <a href="/resource/2"></a>
          <a href="/resource/3"></a>
          <a href="/resource/4"></a>
          <a href="/resource/5"></a>
        </body></html>
      `, 'http://localhost:8080/basePath');
      const urls = extractUrls(resp, {
        shouldCrawl: (url) => {
          const resourceId = parseInt(url.substring(url.lastIndexOf('/') + 1));
          return resourceId % 2 === 0;
        },
      });
      expect(urls).toEqual([
        'http://localhost:8080/resource/2',
        'http://localhost:8080/resource/4',
      ]);
    });
  });

  describe('selector option', () => {
    it('scopes link extraction to selector', () => {
      const resp = htmlResponse(`
        <html><body>
          <nav><a href="http://example.com/nav">Nav</a></nav>
          <main class="content">
            <a href="http://example.com/main">Main</a>
          </main>
        </body></html>
      `);
      const urls = extractUrls(resp, { selector: '.content' });
      expect(urls).toEqual(['http://example.com/main']);
    });

    it('returns empty when selector matches nothing', () => {
      const resp = htmlResponse(`
        <html><body>
          <a href="http://example.com/a">A</a>
        </body></html>
      `);
      const urls = extractUrls(resp, { selector: '.nonexistent' });
      expect(urls).toEqual([]);
    });

    it('handles multiple matching selector elements', () => {
      const resp = htmlResponse(`
        <html><body>
          <div class="section"><a href="http://example.com/a">A</a></div>
          <div class="section"><a href="http://example.com/b">B</a></div>
          <div class="other"><a href="http://example.com/c">C</a></div>
        </body></html>
      `);
      const urls = extractUrls(resp, { selector: '.section' });
      expect(urls).toEqual(['http://example.com/a', 'http://example.com/b']);
    });
  });

  describe('base url specified in HTML', () => {
    const defaultBaseUrl = 'http://localhost:8080/defaultbase/';
    const specifiedAbsoluteBaseUrl = 'http://localhost:8080/specifiedabsolutebase/';
    const specifiedRelativeBaseUrl = 'specifiedrelativebase/';

    it('resolves relative urls using absolute base url', () => {
      const resp = htmlResponse(
        `<base href="${specifiedAbsoluteBaseUrl}">` +
        '<a href="resource/1"></a>' +
        '<a href="resource/2"></a>' +
        '<a href="resource/3"></a>',
        defaultBaseUrl,
      );
      expect(extractUrls(resp)).toEqual([
        'http://localhost:8080/specifiedabsolutebase/resource/1',
        'http://localhost:8080/specifiedabsolutebase/resource/2',
        'http://localhost:8080/specifiedabsolutebase/resource/3',
      ]);
    });

    it('resolves absolute urls to themselves', () => {
      const resp = htmlResponse(
        `<base href="${specifiedAbsoluteBaseUrl}">` +
        '<a href="/resource/1"></a>',
        defaultBaseUrl,
      );
      expect(extractUrls(resp)).toEqual([
        'http://localhost:8080/resource/1',
      ]);
    });

    it('resolves relative urls with relative base url', () => {
      const resp = htmlResponse(
        `<base href="${specifiedRelativeBaseUrl}">` +
        '<a href="resource/1"></a>',
        defaultBaseUrl,
      );
      expect(extractUrls(resp)).toEqual([
        'http://localhost:8080/defaultbase/specifiedrelativebase/resource/1',
      ]);
    });
  });

  describe('encoding handling', () => {
    it('handles latin1 encoded content', () => {
      const latin1Body = Buffer.from('<html><body><a href="http://example.com/café">Link</a></body></html>', 'latin1');
      const resp: HttpResponse = {
        headers: { 'content-type': 'text/html; charset=iso-8859-1' },
        body: latin1Body,
        statusCode: 200,
        url: 'http://example.com/',
        redirectUrls: [],
      };
      const urls = extractUrls(resp);
      expect(urls.length).toBe(1);
      expect(urls[0]).toContain('example.com');
    });
  });
});
