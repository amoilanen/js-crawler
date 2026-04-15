import { describe, it, expect, vi, beforeEach } from 'vitest';
import State from '../src/state.js';

describe('State', () => {
  const urls = [
    'http://url1/',
    'http://url2/',
    'http://url3/',
  ];
  const [url1, url2, url3] = urls;
  let state: State;
  let onCrawlingFinished: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onCrawlingFinished = vi.fn();
    state = new State({ onCrawlingFinished });
  });

  describe('empty state', () => {
    it('should have empty collections', () => {
      expect(state.visitedUrls.size).toBe(0);
      expect(state.crawledUrls.size).toBe(0);
      expect(state.beingCrawledUrls.size).toBe(0);
      expect(state.pendingCount).toBe(0);
    });
  });

  describe('startedCrawling & isBeingCrawled', () => {
    it('should add url to set of urls being crawled', () => {
      expect(state.isBeingCrawled(url1)).toBe(false);

      state.startedCrawling(url1);

      expect(state.isBeingCrawled(url1)).toBe(true);
      expect(state.beingCrawledUrls.has(url1)).toBe(true);
      expect(state.pendingCount).toBe(1);
    });

    describe('url normalization', () => {
      it('should normalize url when starting crawling', () => {
        state.startedCrawling('http://url');

        expect(state.isBeingCrawled('http://url/')).toBe(true);
        expect(state.beingCrawledUrls.has('http://url/')).toBe(true);
      });

      it('should normalize url when checking if it is being crawled', () => {
        state.startedCrawling('http://url/');

        expect(state.isBeingCrawled('http://url')).toBe(true);
      });

      it('should normalize default port for http', () => {
        state.startedCrawling('http://example.com:80/page');
        expect(state.isBeingCrawled('http://example.com/page')).toBe(true);
      });

      it('should normalize mixed case host', () => {
        state.startedCrawling('http://EXAMPLE.COM/path');
        expect(state.isBeingCrawled('http://example.com/path')).toBe(true);
      });
    });

    it('should not store duplicates of urls being crawled', () => {
      state.startedCrawling(url1);
      state.startedCrawling(url1);
      state.startedCrawling(url1);

      expect(state.isBeingCrawled(url1)).toBe(true);
      expect(state.beingCrawledUrls.size).toBe(1);
      expect(state.pendingCount).toBe(1);
    });

    it('should track multiple distinct URLs', () => {
      state.startedCrawling(url1);
      state.startedCrawling(url2);
      expect(state.pendingCount).toBe(2);
      expect(state.beingCrawledUrls.size).toBe(2);
    });
  });

  describe('rememberVisitedUrls & isVisitedUrl', () => {
    it('should add all urls to the set of visited urls', () => {
      expect(state.isVisitedUrl(url1)).toBe(false);
      expect(state.isVisitedUrl(url2)).toBe(false);
      expect(state.isVisitedUrl(url3)).toBe(false);

      state.rememberVisitedUrls([url1, url2]);

      expect(state.isVisitedUrl(url1)).toBe(true);
      expect(state.isVisitedUrl(url2)).toBe(true);
      expect(state.isVisitedUrl(url3)).toBe(false);
      expect(state.visitedUrls.has(url1)).toBe(true);
      expect(state.visitedUrls.has(url2)).toBe(true);
    });

    it('should handle duplicate URLs', () => {
      state.rememberVisitedUrls([url1, url1]);
      expect(state.visitedUrls.size).toBe(1);
    });

    describe('url normalization', () => {
      it('should normalize url when remembering visited url', () => {
        state.rememberVisitedUrls(['http://url']);

        expect(state.isVisitedUrl('http://url/')).toBe(true);
        expect(state.visitedUrls.has('http://url/')).toBe(true);
      });

      it('should normalize url when checking if it was visited', () => {
        state.rememberVisitedUrls(['http://url/']);

        expect(state.isVisitedUrl('http://url')).toBe(true);
      });
    });
  });

  describe('rememberCrawledUrl & isVisitedUrl', () => {
    it('should add url to both visited and crawled sets', () => {
      expect(state.isVisitedUrl(url1)).toBe(false);

      state.rememberCrawledUrl(url1);

      expect(state.isVisitedUrl(url1)).toBe(true);
      expect(state.crawledUrls.has(url1)).toBe(true);
      expect(state.visitedUrls.has(url1)).toBe(true);
    });

    describe('url normalization', () => {
      it('should normalize url when remembering crawled url', () => {
        state.rememberCrawledUrl('http://url');

        expect(state.isVisitedUrl('http://url/')).toBe(true);
        expect(state.crawledUrls.has('http://url/')).toBe(true);
        expect(state.visitedUrls.has('http://url/')).toBe(true);
      });
    });
  });

  describe('finishedCrawling', () => {
    it('should call onCrawlingFinished when the only url was crawled', () => {
      state.startedCrawling(url1);
      state.rememberCrawledUrl(url1);
      state.finishedCrawling(url1);
      expect(onCrawlingFinished).toHaveBeenCalledWith([url1]);
    });

    it('should not call onCrawlingFinished if started and finished urls are different', () => {
      state.startedCrawling(url1);
      state.rememberCrawledUrl(url1);
      state.finishedCrawling(url2);
      expect(onCrawlingFinished).not.toHaveBeenCalled();
    });

    it('should not call onCrawlingFinished when there are urls being crawled', () => {
      state.startedCrawling(url1);
      state.startedCrawling(url2);
      state.rememberCrawledUrl(url1);
      state.finishedCrawling(url1);
      expect(onCrawlingFinished).not.toHaveBeenCalled();
    });

    it('should be called when all urls were crawled', () => {
      urls.forEach(url => {
        state.startedCrawling(url);
        state.rememberCrawledUrl(url);
        state.finishedCrawling(url);
      });
      // Should have been called after each url when pendingCount reaches 0
      // But since we start+finish one at a time, it fires after the first one
      // because pendingCount goes 1->0 each time
      expect(onCrawlingFinished).toHaveBeenCalledWith(expect.arrayContaining(urls));
    });

    it('should call onCrawlingFinished when urls have redirects', () => {
      const redirectUrls = ['http://redirect1/', 'http://redirect2/', 'http://redirect3/', url1];
      state.startedCrawling('http://redirect1/');
      state.rememberVisitedUrls(redirectUrls);
      state.rememberCrawledUrl(url1);
      state.finishedCrawling('http://redirect1/');
      expect(onCrawlingFinished).toHaveBeenCalledWith([url1]);
    });

    it('should handle finishedCrawling for url not being crawled gracefully', () => {
      state.finishedCrawling(url1);
      expect(state.beingCrawledUrls.size).toBe(0);
    });

    it('should be callable without arguments when no pending work', () => {
      state.finishedCrawling();
      expect(onCrawlingFinished).toHaveBeenCalledWith([]);
    });

    it('should remove URL from beingCrawledUrls and decrement pendingCount', () => {
      state.startedCrawling(url1);
      state.startedCrawling(url2);
      state.finishedCrawling(url1);
      expect(state.isBeingCrawled(url1)).toBe(false);
      expect(state.pendingCount).toBe(1);
      expect(onCrawlingFinished).not.toHaveBeenCalled();
    });

    it('should not decrement pendingCount below 0', () => {
      state.finishedCrawling('http://nonexistent.com/');
      expect(state.pendingCount).toBe(0);
    });

    describe('normalization', () => {
      it('should normalize url when finishing crawling', () => {
        state.startedCrawling('http://url/');
        state.rememberCrawledUrl('http://url/');
        state.finishedCrawling('http://url');
        expect(onCrawlingFinished).toHaveBeenCalledWith(['http://url/']);
      });
    });
  });

  describe('isFinished()', () => {
    it('should return true when no work is pending', () => {
      expect(state.isFinished()).toBe(true);
    });

    it('should return false when work is pending', () => {
      state.startedCrawling('http://example.com/');
      expect(state.isFinished()).toBe(false);
    });

    it('should return true after all work completes', () => {
      state.startedCrawling('http://example.com/');
      state.finishedCrawling('http://example.com/');
      expect(state.isFinished()).toBe(true);
    });
  });

  describe('clear()', () => {
    it('should reset all state', () => {
      state.startedCrawling(url1);
      state.rememberVisitedUrls([url1]);
      state.rememberCrawledUrl(url1);

      state.clear();

      expect(state.visitedUrls.size).toBe(0);
      expect(state.crawledUrls.size).toBe(0);
      expect(state.beingCrawledUrls.size).toBe(0);
      expect(state.pendingCount).toBe(0);
    });

    it('should return this for chaining', () => {
      expect(state.clear()).toBe(state);
    });
  });

  describe('freeze()', () => {
    it('should return serializable arrays', () => {
      state.rememberVisitedUrls([url1, url2]);
      state.rememberCrawledUrl(url1);

      const frozen = state.freeze();

      expect(Array.isArray(frozen.visitedUrls)).toBe(true);
      expect(Array.isArray(frozen.crawledUrls)).toBe(true);
      expect(frozen.visitedUrls).toEqual(expect.arrayContaining([url1, url2]));
      expect(frozen.visitedUrls).toHaveLength(2);
      expect(frozen.crawledUrls).toEqual([url1]);
    });
  });

  describe('defrost()', () => {
    it('should restore state from frozen data', () => {
      const data = {
        visitedUrls: [url1, url2],
        crawledUrls: [url1],
      };

      state.defrost(data);

      expect(state.isVisitedUrl(url1)).toBe(true);
      expect(state.isVisitedUrl(url2)).toBe(true);
      expect(state.crawledUrls.has(url1)).toBe(true);
      expect(state.crawledUrls.has(url2)).toBe(false);
    });

    it('should clear existing state before restoring', () => {
      state.rememberCrawledUrl(url1);
      state.startedCrawling(url1);

      state.defrost({
        visitedUrls: [url2],
        crawledUrls: [url2],
      });

      expect(state.isVisitedUrl(url1)).toBe(false);
      expect(state.isVisitedUrl(url2)).toBe(true);
      expect(state.pendingCount).toBe(0);
      expect(state.beingCrawledUrls.size).toBe(0);
    });

    it('should round-trip with freeze()', () => {
      state.rememberVisitedUrls([url1, url2]);
      state.rememberCrawledUrl(url1);

      const frozen = state.freeze();

      const state2 = new State({ onCrawlingFinished: vi.fn() });
      state2.defrost(frozen);

      expect(state2.isVisitedUrl(url1)).toBe(true);
      expect(state2.isVisitedUrl(url2)).toBe(true);
      expect(state2.crawledUrls.has(url1)).toBe(true);
      expect(state2.crawledUrls.size).toBe(1);
    });
  });
});
