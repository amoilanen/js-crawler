import { describe, it, expect, vi } from 'vitest';
import Configuration, { DEFAULT_OPTIONS } from '../src/configuration.js';
import type { CrawlCallbackOptions, CrawlPage } from '../src/types.js';

describe('Configuration', () => {
  describe('default options', () => {
    it('should initialize with default values', () => {
      const config = new Configuration();
      expect(config.config.depth).toBe(2);
      expect(config.config.ignoreRelative).toBe(false);
      expect(config.config.userAgent).toBe('crawler/js-crawler');
      expect(config.config.maxConcurrentRequests).toBe(10);
      expect(config.config.maxRequestsPerSecond).toBe(100);
      expect(config.config.requestTimeout).toBe(30000);
      expect(config.config.maxRetries).toBe(2);
      expect(config.config.retryDelay).toBe(1000);
      expect(config.config.maxPages).toBeUndefined();
      expect(config.config.selector).toBeUndefined();
      expect(config.config.headers).toEqual({});
      expect(config.config.respectRobotsTxt).toBe(false);
      expect(config.config.debug).toBe(false);
    });

    it('should have no-op callbacks by default', () => {
      const config = new Configuration();
      expect(typeof config.config.success).toBe('function');
      expect(typeof config.config.failure).toBe('function');
      expect(typeof config.config.finished).toBe('function');
      expect(config.config.success({} as CrawlPage)).toBeUndefined();
      expect(config.config.finished([])).toBeUndefined();
    });

    it('should crawl all urls by default', () => {
      const config = new Configuration();
      expect(config.config.shouldCrawl!('http://example.com')).toBe(true);
    });

    it('should crawl links from all urls by default', () => {
      const config = new Configuration();
      expect(config.config.shouldCrawlLinksFrom!('http://example.com')).toBe(true);
    });
  });

  describe('configure()', () => {
    it('should merge options with defaults', () => {
      const config = new Configuration();
      config.configure({ depth: 5, userAgent: 'my-bot' });
      expect(config.config.depth).toBe(5);
      expect(config.config.userAgent).toBe('my-bot');
      expect(config.config.maxConcurrentRequests).toBe(DEFAULT_OPTIONS.maxConcurrentRequests);
    });

    it('should clamp depth to minimum of 0', () => {
      const config = new Configuration();
      config.configure({ depth: -1 });
      expect(config.config.depth).toBe(0);
    });

    it('should allow depth of 0', () => {
      const config = new Configuration();
      config.configure({ depth: 0 });
      expect(config.config.depth).toBe(0);
    });

    it('should override new v2 options', () => {
      const config = new Configuration();
      config.configure({
        requestTimeout: 5000,
        maxRetries: 0,
        retryDelay: 500,
        maxPages: 100,
        selector: '.content',
        headers: { 'X-Custom': 'value' },
        respectRobotsTxt: true,
        debug: true,
      });
      expect(config.config.requestTimeout).toBe(5000);
      expect(config.config.maxRetries).toBe(0);
      expect(config.config.retryDelay).toBe(500);
      expect(config.config.maxPages).toBe(100);
      expect(config.config.selector).toBe('.content');
      expect(config.config.headers).toEqual({ 'X-Custom': 'value' });
      expect(config.config.respectRobotsTxt).toBe(true);
      expect(config.config.debug).toBe(true);
    });

    it('should override shouldCrawl and shouldCrawlLinksFrom', () => {
      const config = new Configuration();
      const customFilter = (url: string) => url.includes('example.com');
      config.configure({ shouldCrawl: customFilter, shouldCrawlLinksFrom: customFilter });
      expect(config.config.shouldCrawl!('http://example.com')).toBe(true);
      expect(config.config.shouldCrawl!('http://other.com')).toBe(false);
    });

    it('should reset to defaults when called again', () => {
      const config = new Configuration();
      config.configure({ depth: 10 });
      config.configure({ userAgent: 'new-agent' });
      expect(config.config.depth).toBe(2); // reset to default
      expect(config.config.userAgent).toBe('new-agent');
    });
  });

  describe('options getter', () => {
    it('should return only crawl option keys, not callbacks', () => {
      const config = new Configuration();
      const opts = config.options;
      expect(opts.depth).toBe(2);
      expect(opts.userAgent).toBe('crawler/js-crawler');
      expect(opts.maxConcurrentRequests).toBe(10);
      expect(opts.requestTimeout).toBe(30000);
      expect(opts.maxRetries).toBe(2);
      expect(opts.retryDelay).toBe(1000);
      expect(opts.respectRobotsTxt).toBe(false);
      expect(opts.debug).toBe(false);
      // Should not have callback keys
      expect((opts as any).success).toBeUndefined();
      expect((opts as any).failure).toBeUndefined();
      expect((opts as any).finished).toBeUndefined();
    });
  });

  describe('callbacks getter', () => {
    it('should return callback functions', () => {
      const config = new Configuration();
      const cbs = config.callbacks;
      expect(typeof cbs.success).toBe('function');
      expect(typeof cbs.failure).toBe('function');
      expect(typeof cbs.finished).toBe('function');
    });
  });

  describe('updateAndReturnUrl()', () => {
    it('should handle string URL with callbacks', () => {
      const config = new Configuration();
      const success = vi.fn();
      const failure = vi.fn();
      const finished = vi.fn();

      const url = config.updateAndReturnUrl('http://example.com', success, failure, finished);

      expect(url).toBe('http://example.com');
      expect(config.callbacks).toEqual({ success, failure, finished });
    });

    it('should handle string URL with no callbacks (uses no-ops)', () => {
      const config = new Configuration();
      const url = config.updateAndReturnUrl('http://example.com');

      expect(url).toBe('http://example.com');
      expect(typeof config.config.success).toBe('function');
      expect(config.config.success({} as CrawlPage)).toBeUndefined();
    });

    it('should handle string URL with partial callbacks', () => {
      const config = new Configuration();
      const success = vi.fn();
      const url = config.updateAndReturnUrl('http://example.com', success);

      expect(url).toBe('http://example.com');
      expect(config.config.success).toBe(success);
      expect(typeof config.config.failure).toBe('function');
      expect(typeof config.config.finished).toBe('function');
    });

    it('should handle options object with all callbacks', () => {
      const config = new Configuration();
      const success = vi.fn();
      const failure = vi.fn();
      const finished = vi.fn();

      const url = config.updateAndReturnUrl({ url: 'http://example.com/page', success, failure, finished });

      expect(url).toBe('http://example.com/page');
      expect(config.callbacks).toEqual({ success, failure, finished });
    });

    it('should handle options object with partial callbacks', () => {
      const config = new Configuration();
      const success = vi.fn();

      const url = config.updateAndReturnUrl({ url: 'http://example.com', success });

      expect(url).toBe('http://example.com');
      expect(config.config.success).toBe(success);
      expect(typeof config.config.failure).toBe('function');
      expect(typeof config.config.finished).toBe('function');
    });

    it('should preserve existing crawl options when updating callbacks', () => {
      const config = new Configuration();
      config.configure({ depth: 5, maxPages: 50 });

      config.updateAndReturnUrl('http://example.com', vi.fn());

      expect(config.config.depth).toBe(5);
      expect(config.config.maxPages).toBe(50);
    });
  });
});
