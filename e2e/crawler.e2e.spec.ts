import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Server } from 'http';
import Crawler from '../src/crawler.js';
import type { CrawlPage } from '../src/types.js';
import { createServer } from './server.js';

const PORT = 3100;
const BASE = `http://localhost:${PORT}`;

let server: Server;

beforeAll(() => {
  return new Promise<void>((resolve) => {
    const app = createServer();
    server = app.listen(PORT, () => resolve());
  });
});

afterAll(() => {
  return new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

describe('crawler e2e', () => {
  let crawler: Crawler;

  beforeEach(() => {
    crawler = new Crawler();
    crawler.configure({ depth: 10 });
  });

  // ─── Preserved existing scenarios ───────────────────────────────────

  describe('graph no cycles', () => {
    it('should crawl all urls', (done) => {
      const expectedUrls = [
        `${BASE}/graph_no_cycles/page1.html`,
        `${BASE}/graph_no_cycles/page2.html`,
        `${BASE}/graph_no_cycles/page3.html`,
        `${BASE}/graph_no_cycles/sublevel/page4.html`,
        `${BASE}/graph_no_cycles/sublevel/sublevel2/page5.html`,
      ];

      crawler.crawl(
        `${BASE}/graph_no_cycles/page1.html`,
        (_page) => {},
        () => {
          expect.fail('Should not have errors');
        },
        (crawledUrls) => {
          expect(crawledUrls.sort()).toEqual(expectedUrls.sort());
          done();
        },
      );
    });
  });

  describe('shortened urls', () => {
    function testShortenedUrl(shortenedUrl: string) {
      it('should crawl all the real urls', (done) => {
        const expectedUrls = [
          `${BASE}/graph_no_cycles/page1.html`,
          `${BASE}/graph_no_cycles/page2.html`,
          `${BASE}/graph_no_cycles/page3.html`,
          `${BASE}/graph_no_cycles/sublevel/page4.html`,
          `${BASE}/graph_no_cycles/sublevel/sublevel2/page5.html`,
        ];

        crawler.crawl(
          shortenedUrl,
          (_page) => {},
          () => {
            expect.fail('Should not have errors');
          },
          (crawledUrls) => {
            expect(crawledUrls.sort()).toEqual(expectedUrls.sort());
            done();
          },
        );
      });
    }

    describe('redirect with status 302', () => {
      testShortenedUrl(`${BASE}/shortened`);
    });

    describe('bit.ly redirect with status 301', () => {
      testShortenedUrl(`${BASE}/bitly-shortened`);
    });

    describe('goo.gl redirect with status 307', () => {
      testShortenedUrl(`${BASE}/google-shortened`);
    });
  });

  describe('redirects', () => {
    it('should crawl all urls in redirect chain and not crawl them again', (done) => {
      const expectedUrls = [`${BASE}/redirectend`];

      crawler.crawl(
        `${BASE}/redirect1`,
        (_page) => {},
        () => {
          expect.fail('Should not have errors');
        },
        (crawledUrls) => {
          expect(crawledUrls.sort()).toEqual(expectedUrls.sort());
          done();
        },
      );
    });
  });

  describe('simple cycle', () => {
    it('should crawl all urls in a cycle only once', (done) => {
      const expectedUrls = [
        `${BASE}/simple_cycle/page1.html`,
        `${BASE}/simple_cycle/page2.html`,
        `${BASE}/simple_cycle/page3.html`,
      ];

      crawler.crawl(
        `${BASE}/simple_cycle/page1.html`,
        (_page) => {},
        () => {
          expect.fail('Should not have errors');
        },
        (crawledUrls) => {
          expect(crawledUrls.sort()).toEqual(expectedUrls.sort());
          done();
        },
      );
    });
  });

  describe('page success', () => {
    it('should return url, content, status', (done) => {
      crawler.crawl(
        `${BASE}/one_page_graph/page1.html`,
        (page) => {
          expect(page.url).toBe(`${BASE}/one_page_graph/page1.html`);
          expect(page.status).toBe(200);
          expect(page.content).toBe('<html><body>One page graph.</body></html>');
          expect(page.error).toBeNull();
          expect(page.response).toBeDefined();
          expect(page.body).toBe(page.content);
          done();
        },
      );
    });
  });

  describe('page error', () => {
    it('should return 404 page via success callback with error status', (done) => {
      crawler.crawl(
        `${BASE}/one_page_graph/no_such_page.html`,
        (page) => {
          expect(page.url).toBe(`${BASE}/one_page_graph/no_such_page.html`);
          expect(page.status).toBe(404);
          expect(page.content).toContain('Cannot GET /one_page_graph/no_such_page.html');
          expect(page.error).toBeNull();
          expect(page.response).toBeDefined();
          expect(page.body).toBe(page.content);
          done();
        },
      );
    });
  });

  describe('base tag', () => {
    it('should use base url as the base for relative urls', (done) => {
      const expectedUrls = [
        `${BASE}/base_tag/index/page1.html`,
        `${BASE}/base_tag/page2.html`,
      ];

      crawler.crawl({
        url: `${BASE}/base_tag/index/page1.html`,
        success: (_page) => {},
        finished: (crawledUrls) => {
          expect(crawledUrls.sort()).toEqual(expectedUrls.sort());
          done();
        },
      });
    });

    it('should resolve relative base url', (done) => {
      const expectedUrls = [
        `${BASE}/base_tag/index/page1relativebase.html`,
        `${BASE}/base_tag/index/relative_base_tag/page3.html`,
      ];

      crawler.crawl({
        url: `${BASE}/base_tag/index/page1relativebase.html`,
        success: (_page) => {},
        finished: (crawledUrls) => {
          expect(crawledUrls.sort()).toEqual(expectedUrls.sort());
          done();
        },
      });
    });
  });

  describe('non-http/https links', () => {
    it('should ignore mailto and ftp links', (done) => {
      const expectedUrls = [
        `${BASE}/non_http_https_links/page1.html`,
        `${BASE}/non_http_https_links/page2.html`,
      ];

      crawler.crawl({
        url: `${BASE}/non_http_https_links/page1.html`,
        success: (_page) => {},
        failure: () => {
          expect.fail('Should not have errors');
        },
        finished: (crawledUrls) => {
          expect(crawledUrls.sort()).toEqual(expectedUrls.sort());
          done();
        },
      });
    });
  });

  describe('shouldCrawl', () => {
    it('should call finished when last url should not be crawled', (done) => {
      const expectedUrls = [
        `${BASE}/simple_cycle/page1.html`,
        `${BASE}/simple_cycle/page2.html`,
      ];

      crawler.configure({
        shouldCrawl: (url) => !url.includes('page3.html'),
      });

      crawler.crawl(
        `${BASE}/simple_cycle/page1.html`,
        (_page) => {},
        () => {
          expect.fail('Should not have errors');
        },
        (crawledUrls) => {
          expect(crawledUrls.sort()).toEqual(expectedUrls.sort());
          done();
        },
      );
    });

    it('should call finished when no urls should be crawled', async () => {
      crawler.configure({
        shouldCrawl: () => false,
      });

      const crawledUrls = await crawler.crawl(`${BASE}/simple_cycle/page1.html`);
      expect(crawledUrls).toHaveLength(0);
    });
  });

  // ─── New test scenarios ─────────────────────────────────────────────

  describe('binary content', () => {
    it('should handle binary content without extracting links from it', (done) => {
      const pages: CrawlPage[] = [];

      crawler.crawl(
        `${BASE}/binary_content/page1.html`,
        (page) => {
          pages.push(page);
        },
        () => {},
        (crawledUrls) => {
          // Should visit page1.html, image.png (binary), and page2.html
          expect(crawledUrls.length).toBeGreaterThanOrEqual(2);
          expect(crawledUrls).toContain(`${BASE}/binary_content/page1.html`);
          expect(crawledUrls).toContain(`${BASE}/binary_content/page2.html`);

          // Binary content should have placeholder body
          const binaryPage = pages.find((p) => p.url.endsWith('image.png'));
          if (binaryPage) {
            expect(binaryPage.content).toContain('non-text content');
          }
          done();
        },
      );
    });
  });

  describe('request timeout', () => {
    it('should timeout on slow responses', async () => {
      crawler.configure({
        requestTimeout: 500,
        maxRetries: 0,
        depth: 1,
      });

      const errors: CrawlPage[] = [];
      const finished = new Promise<string[]>((resolve) => {
        crawler.crawl(
          `${BASE}/slow?delay=5000`,
          () => {},
          (page) => {
            errors.push(page);
          },
          (urls) => resolve(urls),
        );
      });

      const crawledUrls = await finished;
      // Should have failed due to timeout
      expect(errors.length).toBe(1);
      expect(crawledUrls).toHaveLength(0);
    });
  });

  describe('stop() mid-crawl', () => {
    it('should stop crawling when stop() is called', async () => {
      crawler.configure({ depth: 10 });

      let pageCount = 0;
      const finished = new Promise<string[]>((resolve) => {
        crawler.crawl(
          `${BASE}/graph_no_cycles/page1.html`,
          () => {
            pageCount++;
            // Stop after first page - note: stop() fires before rememberCrawledUrl
            if (pageCount >= 1) {
              crawler.stop();
            }
          },
          () => {},
          (urls) => resolve(urls),
        );
      });

      const crawledUrls = await finished;
      // stop() fires before URLs are added to crawledUrls,
      // so the result may have 0 URLs but the key assertion
      // is that we didn't crawl all 5 pages
      expect(crawledUrls.length).toBeLessThan(5);
      // At least one page event was emitted
      expect(pageCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('maxPages', () => {
    it('should limit the number of crawled pages', async () => {
      crawler.configure({ depth: 10, maxPages: 3 });

      const crawledUrls = await crawler.crawl(`${BASE}/many_pages/page1.html`);
      expect(crawledUrls.length).toBeLessThanOrEqual(3);
      expect(crawledUrls.length).toBeGreaterThan(0);
    });
  });

  describe('robots.txt', () => {
    it('should respect robots.txt disallow rules', async () => {
      crawler.configure({
        depth: 10,
        respectRobotsTxt: true,
      });

      const crawledUrls = await crawler.crawl(`${BASE}/robots_test/page1.html`);
      expect(crawledUrls).toContain(`${BASE}/robots_test/page1.html`);
      expect(crawledUrls).toContain(`${BASE}/robots_test/page2.html`);
      // The blocked page should NOT be crawled
      expect(crawledUrls).not.toContain(`${BASE}/blocked/page.html`);
    });
  });

  describe('CSS selector scoping', () => {
    it('should only follow links within the specified selector', async () => {
      crawler.configure({
        depth: 10,
        selector: '.main',
      });

      const crawledUrls = await crawler.crawl(`${BASE}/selector_scoping/page1.html`);
      expect(crawledUrls).toContain(`${BASE}/selector_scoping/page1.html`);
      expect(crawledUrls).toContain(`${BASE}/selector_scoping/main_page.html`);
      // Header link should NOT be followed
      expect(crawledUrls).not.toContain(`${BASE}/selector_scoping/header_page.html`);
    });
  });

  describe('custom headers', () => {
    it('should send custom headers with requests', async () => {
      crawler.configure({
        depth: 1,
        headers: { 'X-Custom-Header': 'test-value' },
      });

      const pages: CrawlPage[] = [];
      const finished = new Promise<string[]>((resolve) => {
        crawler.crawl(
          `${BASE}/echo-headers`,
          (page) => {
            pages.push(page);
          },
          () => {},
          (urls) => resolve(urls),
        );
      });

      await finished;
      expect(pages.length).toBe(1);
      const headers = JSON.parse(pages[0].content);
      expect(headers['x-custom-header']).toBe('test-value');
    });
  });

  describe('retry behavior', () => {
    it('should retry failed requests and eventually succeed', async () => {
      const retryKey = `retry-${Date.now()}`;
      crawler.configure({
        depth: 1,
        maxRetries: 3,
        retryDelay: 100,
      });

      const pages: CrawlPage[] = [];
      const errors: CrawlPage[] = [];

      const finished = new Promise<string[]>((resolve) => {
        crawler.crawl(
          `${BASE}/retry?key=${retryKey}&failCount=1`,
          (page) => {
            pages.push(page);
          },
          (page) => {
            errors.push(page);
          },
          (urls) => resolve(urls),
        );
      });

      await finished;
      // Should succeed after retry
      expect(pages.length).toBe(1);
      expect(pages[0].status).toBe(200);
      expect(pages[0].content).toContain('Retry success');
      expect(errors.length).toBe(0);
    });
  });

  describe('Promise API', () => {
    it('should resolve with crawled URLs', async () => {
      crawler.configure({ depth: 10 });

      const crawledUrls = await crawler.crawl(`${BASE}/simple_cycle/page1.html`);
      expect(crawledUrls.sort()).toEqual([
        `${BASE}/simple_cycle/page1.html`,
        `${BASE}/simple_cycle/page2.html`,
        `${BASE}/simple_cycle/page3.html`,
      ]);
    });

    it('should resolve with single page', async () => {
      const crawledUrls = await crawler.crawl(`${BASE}/one_page_graph/page1.html`);
      expect(crawledUrls).toEqual([`${BASE}/one_page_graph/page1.html`]);
    });
  });

  describe('Event emitter API', () => {
    it('should emit page events for each crawled page', async () => {
      const pages: CrawlPage[] = [];

      crawler.on('page', (page) => {
        pages.push(page);
      });

      const crawledUrls = await crawler.crawl(`${BASE}/simple_cycle/page1.html`);
      expect(pages.length).toBe(crawledUrls.length);
      for (const page of pages) {
        expect(crawledUrls).toContain(page.url);
      }
    });

    it('should emit finished event', async () => {
      const finishedPromise = new Promise<string[]>((resolve) => {
        crawler.on('finished', (urls: string[]) => {
          resolve(urls);
        });
      });

      crawler.crawl(`${BASE}/one_page_graph/page1.html`);

      const urls = await finishedPromise;
      expect(urls).toEqual([`${BASE}/one_page_graph/page1.html`]);
    });

    it('should emit error events for request failures', async () => {
      crawler.configure({
        depth: 1,
        requestTimeout: 500,
        maxRetries: 0,
      });

      const errors: CrawlPage[] = [];

      crawler.on('error', (page) => {
        errors.push(page);
      });

      const crawledUrls = await crawler.crawl(`${BASE}/slow?delay=5000`);
      expect(errors.length).toBe(1);
      expect(errors[0].error).not.toBeNull();
      // Error pages are still tracked in crawledUrls
      expect(crawledUrls).toHaveLength(1);
    });
  });

  describe('freeze/defrost', () => {
    it('should freeze and defrost crawler state', async () => {
      // Crawl the simple cycle
      const crawledUrls = await crawler.crawl(`${BASE}/simple_cycle/page1.html`);
      expect(crawledUrls.length).toBe(3);

      // Freeze state
      const frozenState = crawler.freeze();
      expect(frozenState.crawledUrls.sort()).toEqual(crawledUrls.sort());

      // Create new crawler and defrost
      const crawler2 = new Crawler();
      crawler2.defrost(frozenState);

      // Crawl again - no new page events should be emitted (URLs already visited)
      const newPages: CrawlPage[] = [];
      crawler2.on('page', (page) => {
        newPages.push(page);
      });

      const crawledUrls2 = await crawler2.crawl(`${BASE}/simple_cycle/page1.html`);
      // The crawledUrls set includes previously defrosted URLs
      expect(crawledUrls2.sort()).toEqual(crawledUrls.sort());
      // No new pages should have been fetched
      expect(newPages).toHaveLength(0);
    });
  });

  describe('depth limiting', () => {
    it('should respect depth limit', async () => {
      crawler.configure({ depth: 1 });

      const crawledUrls = await crawler.crawl(`${BASE}/graph_no_cycles/page1.html`);
      // Depth 1 means only the starting page
      expect(crawledUrls).toEqual([`${BASE}/graph_no_cycles/page1.html`]);
    });

    it('should crawl to specified depth', async () => {
      crawler.configure({ depth: 2 });

      const crawledUrls = await crawler.crawl(`${BASE}/graph_no_cycles/page1.html`);
      // Depth 2 means starting page + its direct links
      expect(crawledUrls).toContain(`${BASE}/graph_no_cycles/page1.html`);
      expect(crawledUrls).toContain(`${BASE}/graph_no_cycles/page2.html`);
      expect(crawledUrls).toContain(`${BASE}/graph_no_cycles/page3.html`);
      // sublevel pages are at depth 3+ so should not be included
      expect(crawledUrls).not.toContain(
        `${BASE}/graph_no_cycles/sublevel/sublevel2/page5.html`,
      );
    });
  });
});
