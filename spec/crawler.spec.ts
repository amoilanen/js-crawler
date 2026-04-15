import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HttpResponse, CrawlPage } from '../src/types.js';

// Mock the request module
vi.mock('../src/request.js', () => ({
  makeRequest: vi.fn(),
}));

// Mock the robots module
vi.mock('../src/robots.js', () => {
  const RobotsCache = vi.fn().mockImplementation(() => ({
    isAllowed: vi.fn().mockResolvedValue(true),
    clear: vi.fn(),
  }));
  return { RobotsCache };
});

import Crawler from '../src/crawler.js';
import { makeRequest } from '../src/request.js';
import { RobotsCache } from '../src/robots.js';

const mockedMakeRequest = vi.mocked(makeRequest);

function htmlResponse(
  url: string,
  body: string,
  opts: { redirectUrls?: string[]; statusCode?: number } = {},
): HttpResponse {
  return {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: Buffer.from(body),
    statusCode: opts.statusCode ?? 200,
    url,
    redirectUrls: opts.redirectUrls ?? [],
  };
}

function binaryResponse(url: string): HttpResponse {
  return {
    headers: { 'content-type': 'image/png' },
    body: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    statusCode: 200,
    url,
    redirectUrls: [],
  };
}

describe('Crawler', () => {
  let crawler: Crawler;

  beforeEach(() => {
    crawler = new Crawler();
    mockedMakeRequest.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('configure()', () => {
    it('should return this for chaining', () => {
      const result = crawler.configure({ depth: 3 });
      expect(result).toBe(crawler);
    });
  });

  describe('crawl() - Promise API', () => {
    it('should resolve with crawled URLs', async () => {
      mockedMakeRequest.mockResolvedValueOnce(
        htmlResponse('http://example.com/', '<html><body>Hello</body></html>'),
      );

      const urls = await crawler.crawl('http://example.com/');
      expect(urls).toContain('http://example.com/');
    });

    it('should crawl linked pages up to configured depth', async () => {
      mockedMakeRequest.mockImplementation(async (opts) => {
        const url = opts.url;
        if (url === 'http://example.com/') {
          return htmlResponse(
            url,
            '<html><body><a href="/page1">Page 1</a><a href="/page2">Page 2</a></body></html>',
          );
        }
        return htmlResponse(url, '<html><body>Leaf</body></html>');
      });

      crawler.configure({ depth: 2 });
      const urls = await crawler.crawl('http://example.com/');
      expect(urls).toContain('http://example.com/');
      expect(urls).toContain('http://example.com/page1');
      expect(urls).toContain('http://example.com/page2');
      expect(urls).toHaveLength(3);
    });

    it('should respect depth=1 (only crawl the start URL)', async () => {
      mockedMakeRequest.mockResolvedValueOnce(
        htmlResponse(
          'http://example.com/',
          '<html><body><a href="/page1">Page 1</a></body></html>',
        ),
      );

      crawler.configure({ depth: 1 });
      const urls = await crawler.crawl('http://example.com/');
      expect(urls).toEqual(['http://example.com/']);
      expect(mockedMakeRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('crawl() - Callback API', () => {
    it('should call success callback for each crawled page', async () => {
      mockedMakeRequest.mockResolvedValueOnce(
        htmlResponse('http://example.com/', '<html>Hello</html>'),
      );

      const success = vi.fn();
      const finished = vi.fn();

      crawler.crawl('http://example.com/', success, undefined, finished);

      await vi.waitFor(() => {
        expect(finished).toHaveBeenCalledTimes(1);
      });

      expect(success).toHaveBeenCalledTimes(1);
      expect(success).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://example.com/',
          status: 200,
        }),
      );
    });

    it('should call failure callback on request error', async () => {
      mockedMakeRequest.mockRejectedValueOnce(new Error('Network error'));

      const success = vi.fn();
      const failure = vi.fn();
      const finished = vi.fn();

      crawler.configure({ maxRetries: 0 });
      crawler.crawl('http://example.com/', success, failure, finished);

      await vi.waitFor(() => {
        expect(finished).toHaveBeenCalledTimes(1);
      });

      expect(success).not.toHaveBeenCalled();
      expect(failure).toHaveBeenCalledTimes(1);
      expect(failure).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://example.com/',
          error: expect.any(Error),
        }),
      );
    });

    it('should call finished callback with all crawled URLs', async () => {
      mockedMakeRequest.mockResolvedValueOnce(
        htmlResponse('http://example.com/', '<html>Hello</html>'),
      );

      const finished = vi.fn();
      crawler.crawl('http://example.com/', undefined, undefined, finished);

      await vi.waitFor(() => {
        expect(finished).toHaveBeenCalledTimes(1);
      });

      expect(finished).toHaveBeenCalledWith(['http://example.com/']);
    });
  });

  describe('crawl() - Options object API', () => {
    it('should accept CrawlCallbackOptions', async () => {
      mockedMakeRequest.mockResolvedValueOnce(
        htmlResponse('http://example.com/', '<html>Hello</html>'),
      );

      const success = vi.fn();
      const finished = vi.fn();

      crawler.crawl({
        url: 'http://example.com/',
        success,
        finished,
      });

      await vi.waitFor(() => {
        expect(finished).toHaveBeenCalledTimes(1);
      });

      expect(success).toHaveBeenCalledTimes(1);
    });
  });

  describe('URL deduplication', () => {
    it('should not crawl the same URL twice', async () => {
      mockedMakeRequest.mockImplementation(async (opts) => {
        if (opts.url === 'http://example.com/') {
          return htmlResponse(
            opts.url,
            '<html><body><a href="/page">Link1</a><a href="/page">Link2</a></body></html>',
          );
        }
        return htmlResponse(opts.url, '<html>Leaf</html>');
      });

      crawler.configure({ depth: 2 });
      const urls = await crawler.crawl('http://example.com/');
      expect(urls).toHaveLength(2);
      // makeRequest called for / and /page, not /page twice
      expect(mockedMakeRequest).toHaveBeenCalledTimes(2);
    });

    it('should track redirect URLs as visited', async () => {
      mockedMakeRequest.mockImplementation(async (opts) => {
        if (opts.url === 'http://example.com/') {
          return htmlResponse(
            'http://example.com/',
            '<html><body><a href="/old">Link</a></body></html>',
          );
        }
        if (opts.url === 'http://example.com/old') {
          return htmlResponse('http://example.com/new', '<html>Redirected</html>', {
            redirectUrls: ['http://example.com/old'],
          });
        }
        return htmlResponse(opts.url, '<html>Page</html>');
      });

      crawler.configure({ depth: 2 });
      const urls = await crawler.crawl('http://example.com/');
      expect(urls).toContain('http://example.com/new');
    });
  });

  describe('shouldCrawl filter', () => {
    it('should skip URLs that shouldCrawl returns false for', async () => {
      mockedMakeRequest.mockImplementation(async (opts) => {
        if (opts.url === 'http://example.com/') {
          return htmlResponse(
            opts.url,
            '<html><body><a href="/allowed">A</a><a href="/blocked">B</a></body></html>',
          );
        }
        return htmlResponse(opts.url, '<html>Leaf</html>');
      });

      crawler.configure({
        depth: 2,
        shouldCrawl: (url) => !url.includes('/blocked'),
      });

      const urls = await crawler.crawl('http://example.com/');
      expect(urls).toContain('http://example.com/allowed');
      expect(urls).not.toContain('http://example.com/blocked');
    });
  });

  describe('shouldCrawlLinksFrom filter', () => {
    it('should not follow links from pages where shouldCrawlLinksFrom returns false', async () => {
      mockedMakeRequest.mockImplementation(async (opts) => {
        if (opts.url === 'http://example.com/') {
          return htmlResponse(
            opts.url,
            '<html><body><a href="/no-follow">NF</a></body></html>',
          );
        }
        if (opts.url === 'http://example.com/no-follow') {
          return htmlResponse(
            opts.url,
            '<html><body><a href="/deeper">Deeper</a></body></html>',
          );
        }
        return htmlResponse(opts.url, '<html>Leaf</html>');
      });

      crawler.configure({
        depth: 3,
        shouldCrawlLinksFrom: (url) => !url.includes('/no-follow'),
      });

      const urls = await crawler.crawl('http://example.com/');
      expect(urls).toContain('http://example.com/no-follow');
      expect(urls).not.toContain('http://example.com/deeper');
    });
  });

  describe('maxPages', () => {
    it('should stop crawling after maxPages is reached', async () => {
      mockedMakeRequest.mockImplementation(async (opts) => {
        if (opts.url === 'http://example.com/') {
          return htmlResponse(
            opts.url,
            '<html><body><a href="/p1">1</a><a href="/p2">2</a><a href="/p3">3</a><a href="/p4">4</a></body></html>',
          );
        }
        return htmlResponse(opts.url, '<html>Leaf</html>');
      });

      crawler.configure({ depth: 2, maxPages: 3 });
      const urls = await crawler.crawl('http://example.com/');
      expect(urls.length).toBeLessThanOrEqual(3);
    });
  });

  describe('stop()', () => {
    it('should stop crawling and resolve with URLs crawled so far', async () => {
      let requestCount = 0;
      mockedMakeRequest.mockImplementation(async (opts) => {
        requestCount++;
        if (requestCount === 1) {
          return htmlResponse(
            opts.url,
            '<html><body><a href="/p1">1</a><a href="/p2">2</a><a href="/p3">3</a></body></html>',
          );
        }
        // Slow responses for subsequent pages
        await new Promise((resolve) => setTimeout(resolve, 100));
        return htmlResponse(opts.url, '<html>Leaf</html>');
      });

      crawler.configure({ depth: 2 });
      const promise = crawler.crawl('http://example.com/');

      // Wait for first page, then stop
      await new Promise((resolve) => setTimeout(resolve, 50));
      crawler.stop();

      const urls = await promise;
      expect(urls).toBeDefined();
      expect(Array.isArray(urls)).toBe(true);
    });
  });

  describe('Event emission', () => {
    it('should emit "page" event for each successful page', async () => {
      mockedMakeRequest.mockResolvedValueOnce(
        htmlResponse('http://example.com/', '<html>Hello</html>'),
      );

      const pageHandler = vi.fn();
      crawler.on('page', pageHandler);

      await crawler.crawl('http://example.com/');

      expect(pageHandler).toHaveBeenCalledTimes(1);
      expect(pageHandler).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'http://example.com/' }),
      );
    });

    it('should emit "error" event on request failure', async () => {
      mockedMakeRequest.mockRejectedValueOnce(new Error('fail'));

      const errorHandler = vi.fn();
      crawler.on('error', errorHandler);
      crawler.configure({ maxRetries: 0 });

      await crawler.crawl('http://example.com/');

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://example.com/',
          error: expect.any(Error),
        }),
      );
    });

    it('should emit "finished" event when crawl completes', async () => {
      mockedMakeRequest.mockResolvedValueOnce(
        htmlResponse('http://example.com/', '<html>Hello</html>'),
      );

      const finishedHandler = vi.fn();
      crawler.on('finished', finishedHandler);

      await crawler.crawl('http://example.com/');

      expect(finishedHandler).toHaveBeenCalledTimes(1);
      expect(finishedHandler).toHaveBeenCalledWith(
        expect.arrayContaining(['http://example.com/']),
      );
    });
  });

  describe('freeze() / defrost()', () => {
    it('should freeze and defrost state', async () => {
      mockedMakeRequest.mockResolvedValueOnce(
        htmlResponse('http://example.com/', '<html>Hello</html>'),
      );

      await crawler.crawl('http://example.com/');
      const frozen = crawler.freeze();

      expect(frozen.visitedUrls).toContain('http://example.com/');
      expect(frozen.crawledUrls).toContain('http://example.com/');
      expect(frozen.options).toBeDefined();

      // Create new crawler and defrost
      const crawler2 = new Crawler();
      crawler2.defrost(frozen);

      // The defrosted crawler should remember visited URLs
      mockedMakeRequest.mockResolvedValueOnce(
        htmlResponse('http://example.com/', '<html>Hello</html>'),
      );

      const urls = await crawler2.crawl('http://example.com/');
      // Already visited, so won't be crawled again — finishes immediately
      expect(mockedMakeRequest).toHaveBeenCalledTimes(1); // Only the first crawl
    });
  });

  describe('forgetCrawled()', () => {
    it('should clear all state', async () => {
      mockedMakeRequest.mockResolvedValue(
        htmlResponse('http://example.com/', '<html>Hello</html>'),
      );

      await crawler.crawl('http://example.com/');
      crawler.forgetCrawled();

      // Should be able to crawl again
      const urls = await crawler.crawl('http://example.com/');
      expect(urls).toContain('http://example.com/');
      expect(mockedMakeRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('binary content', () => {
    it('should report binary content with placeholder body', async () => {
      mockedMakeRequest.mockResolvedValueOnce(binaryResponse('http://example.com/image.png'));

      const success = vi.fn();
      const finished = vi.fn();

      crawler.crawl('http://example.com/image.png', success, undefined, finished);

      await vi.waitFor(() => {
        expect(finished).toHaveBeenCalled();
      });

      expect(success).toHaveBeenCalledTimes(1);
      const page: CrawlPage = success.mock.calls[0][0];
      expect(page.url).toBe('http://example.com/image.png');
      expect(page.body).toContain('non-text content');
    });
  });

  describe('robots.txt integration', () => {
    it('should check robots.txt when respectRobotsTxt is enabled', async () => {
      const mockIsAllowed = vi.fn().mockResolvedValue(true);
      vi.mocked(RobotsCache).mockImplementation(
        () =>
          ({
            isAllowed: mockIsAllowed,
            clear: vi.fn(),
          }) as unknown as RobotsCache,
      );

      mockedMakeRequest.mockResolvedValueOnce(
        htmlResponse('http://example.com/', '<html>Hello</html>'),
      );

      crawler.configure({ respectRobotsTxt: true });
      await crawler.crawl('http://example.com/');

      expect(mockIsAllowed).toHaveBeenCalledWith('http://example.com/');
    });

    it('should skip URLs disallowed by robots.txt', async () => {
      const mockIsAllowed = vi.fn().mockImplementation(async (url: string) => {
        return !url.includes('/blocked');
      });
      vi.mocked(RobotsCache).mockImplementation(
        () =>
          ({
            isAllowed: mockIsAllowed,
            clear: vi.fn(),
          }) as unknown as RobotsCache,
      );

      mockedMakeRequest.mockImplementation(async (opts) => {
        if (opts.url === 'http://example.com/') {
          return htmlResponse(
            opts.url,
            '<html><body><a href="/blocked">B</a><a href="/allowed">A</a></body></html>',
          );
        }
        return htmlResponse(opts.url, '<html>Leaf</html>');
      });

      crawler.configure({ depth: 2, respectRobotsTxt: true });
      const urls = await crawler.crawl('http://example.com/');

      expect(urls).toContain('http://example.com/');
      expect(urls).toContain('http://example.com/allowed');
      expect(urls).not.toContain('http://example.com/blocked');
    });
  });

  describe('debug mode', () => {
    it('should log when debug is enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockedMakeRequest.mockResolvedValueOnce(
        htmlResponse('http://example.com/', '<html>Hello</html>'),
      );

      crawler.configure({ debug: true });
      await crawler.crawl('http://example.com/');

      expect(consoleSpy).toHaveBeenCalled();
      const messages = consoleSpy.mock.calls.map((c) => c[0]);
      expect(messages.some((m) => typeof m === 'string' && m.includes('[js-crawler]'))).toBe(true);
    });

    it('should not log when debug is disabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockedMakeRequest.mockResolvedValueOnce(
        htmlResponse('http://example.com/', '<html>Hello</html>'),
      );

      await crawler.crawl('http://example.com/');

      const messages = consoleSpy.mock.calls.map((c) => c[0]);
      expect(
        messages.filter((m) => typeof m === 'string' && m.includes('[js-crawler]')),
      ).toHaveLength(0);
    });
  });

  describe('depth control', () => {
    it('should crawl to the correct depth (depth=3)', async () => {
      mockedMakeRequest.mockImplementation(async (opts) => {
        if (opts.url === 'http://example.com/') {
          return htmlResponse(
            opts.url,
            '<html><body><a href="/level1">L1</a></body></html>',
          );
        }
        if (opts.url === 'http://example.com/level1') {
          return htmlResponse(
            opts.url,
            '<html><body><a href="/level2">L2</a></body></html>',
          );
        }
        if (opts.url === 'http://example.com/level2') {
          return htmlResponse(
            opts.url,
            '<html><body><a href="/level3">L3</a></body></html>',
          );
        }
        return htmlResponse(opts.url, '<html>Deep</html>');
      });

      crawler.configure({ depth: 3 });
      const urls = await crawler.crawl('http://example.com/');

      expect(urls).toContain('http://example.com/');
      expect(urls).toContain('http://example.com/level1');
      expect(urls).toContain('http://example.com/level2');
      // level3 is at depth 4, should not be crawled
      expect(urls).not.toContain('http://example.com/level3');
    });

    it('should handle depth=0 gracefully', async () => {
      crawler.configure({ depth: 0 });
      const urls = await crawler.crawl('http://example.com/');
      expect(urls).toEqual([]);
      expect(mockedMakeRequest).not.toHaveBeenCalled();
    });
  });

  describe('CrawlPage structure', () => {
    it('should include referer in the page object', async () => {
      mockedMakeRequest.mockImplementation(async (opts) => {
        if (opts.url === 'http://example.com/') {
          return htmlResponse(
            opts.url,
            '<html><body><a href="/child">C</a></body></html>',
          );
        }
        return htmlResponse(opts.url, '<html>Child</html>');
      });

      const pages: CrawlPage[] = [];
      crawler.on('page', (page) => pages.push(page));
      crawler.configure({ depth: 2 });

      await crawler.crawl('http://example.com/');

      const childPage = pages.find((p) => p.url === 'http://example.com/child');
      expect(childPage).toBeDefined();
      expect(childPage!.referer).toBe('http://example.com/');
    });

    it('should include response object in the page', async () => {
      mockedMakeRequest.mockResolvedValueOnce(
        htmlResponse('http://example.com/', '<html>Hello</html>'),
      );

      const pages: CrawlPage[] = [];
      crawler.on('page', (page) => pages.push(page));

      await crawler.crawl('http://example.com/');

      expect(pages[0].response).toBeDefined();
      expect(pages[0].response.statusCode).toBe(200);
    });
  });

  describe('cycle detection', () => {
    it('should handle circular links without infinite loop', async () => {
      mockedMakeRequest.mockImplementation(async (opts) => {
        if (opts.url === 'http://example.com/a') {
          return htmlResponse(
            opts.url,
            '<html><body><a href="/b">B</a></body></html>',
          );
        }
        if (opts.url === 'http://example.com/b') {
          return htmlResponse(
            opts.url,
            '<html><body><a href="/a">A</a></body></html>',
          );
        }
        return htmlResponse(opts.url, '<html>Leaf</html>');
      });

      crawler.configure({ depth: 10 });
      const urls = await crawler.crawl('http://example.com/a');

      expect(urls).toContain('http://example.com/a');
      expect(urls).toContain('http://example.com/b');
      expect(urls).toHaveLength(2);
    });
  });
});
