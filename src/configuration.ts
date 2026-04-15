import type {
  CrawlerOptions,
  CrawlCallbackOptions,
  CrawlPage,
} from './types.js';

export type SuccessCallback = (page: CrawlPage) => void;
export type FailureCallback = (page: CrawlPage) => void;
export type FinishedCallback = (crawledUrls: string[]) => void;

export interface CrawlCallbacks {
  success: SuccessCallback;
  failure: FailureCallback;
  finished: FinishedCallback;
}

export type ConfigurationOptions = CrawlerOptions & CrawlCallbacks;

const noop = () => {};

const DEFAULT_DEPTH = 2;
const DEFAULT_MAX_CONCURRENT_REQUESTS = 10;
const DEFAULT_MAX_REQUESTS_PER_SECOND = 100;
const DEFAULT_USER_AGENT = 'crawler/js-crawler';
const DEFAULT_REQUEST_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 1000;

export const DEFAULT_OPTIONS: ConfigurationOptions = {
  depth: DEFAULT_DEPTH,
  ignoreRelative: false,
  userAgent: DEFAULT_USER_AGENT,
  maxConcurrentRequests: DEFAULT_MAX_CONCURRENT_REQUESTS,
  maxRequestsPerSecond: DEFAULT_MAX_REQUESTS_PER_SECOND,
  requestTimeout: DEFAULT_REQUEST_TIMEOUT,
  maxRetries: DEFAULT_MAX_RETRIES,
  retryDelay: DEFAULT_RETRY_DELAY,
  maxPages: undefined,
  shouldCrawl: () => true,
  shouldCrawlLinksFrom: () => true,
  selector: undefined,
  headers: {},
  respectRobotsTxt: false,
  debug: false,
  success: noop,
  failure: noop,
  finished: noop,
};

const CRAWL_OPTION_KEYS: (keyof CrawlerOptions)[] = [
  'depth',
  'ignoreRelative',
  'userAgent',
  'maxConcurrentRequests',
  'maxRequestsPerSecond',
  'requestTimeout',
  'maxRetries',
  'retryDelay',
  'maxPages',
  'shouldCrawl',
  'shouldCrawlLinksFrom',
  'selector',
  'headers',
  'respectRobotsTxt',
  'debug',
];

export default class Configuration {
  config: ConfigurationOptions;

  constructor() {
    this.config = { ...DEFAULT_OPTIONS };
  }

  configure(options: CrawlerOptions): void {
    this.config = { ...DEFAULT_OPTIONS, ...options };
    this.config.depth = Math.max(this.config.depth!, 0);
  }

  get options(): CrawlerOptions {
    const result: Record<string, unknown> = {};
    for (const key of CRAWL_OPTION_KEYS) {
      result[key] = this.config[key];
    }
    return result as CrawlerOptions;
  }

  get callbacks(): CrawlCallbacks {
    return {
      success: this.config.success,
      failure: this.config.failure,
      finished: this.config.finished,
    };
  }

  updateAndReturnUrl(
    urlOrOptions: string | CrawlCallbackOptions,
    success?: SuccessCallback,
    failure?: FailureCallback,
    finished?: FinishedCallback,
  ): string {
    if (typeof urlOrOptions !== 'string') {
      const { url, success: s, failure: f, finished: fin } = urlOrOptions;
      this.config = {
        ...this.config,
        success: s ?? noop,
        failure: f ?? noop,
        finished: fin ?? noop,
      };
      return url;
    }

    this.config = {
      ...this.config,
      success: success ?? noop,
      failure: failure ?? noop,
      finished: finished ?? noop,
    };
    return urlOrOptions;
  }
}
