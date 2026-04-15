import { EventEmitter } from 'events';
import type { CrawlerOptions, CrawlerState, CrawlPage, CrawlCallbackOptions } from './types.js';

/**
 * Stub Crawler class — will be fully implemented in a later step.
 */
export default class Crawler extends EventEmitter {
  configure(_options: CrawlerOptions): this {
    return this;
  }

  crawl(_urlOrOptions: string | CrawlCallbackOptions, _onSuccess?: (page: CrawlPage) => void, _onFailure?: (page: CrawlPage) => void, _onFinished?: (crawledUrls: string[]) => void): this & Promise<string[]> {
    return this as this & Promise<string[]>;
  }

  stop(): void {}

  forgetCrawled(): void {}

  freeze(): CrawlerState {
    return { visitedUrls: [], crawledUrls: [], options: {} };
  }

  defrost(_state: CrawlerState): void {}
}
