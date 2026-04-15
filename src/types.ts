export interface CrawlPage {
  url: string;
  status: number;
  content: string;
  error: Error | null;
  response: HttpResponse;
  body: string;
  referer: string;
}

export interface HttpResponse {
  headers: Record<string, string>;
  body: Buffer;
  statusCode: number;
  url: string;
  redirectUrls: string[];
}

export interface CrawlerOptions {
  depth?: number;
  ignoreRelative?: boolean;
  userAgent?: string;
  maxRequestsPerSecond?: number;
  maxConcurrentRequests?: number;
  requestTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  maxPages?: number;
  shouldCrawl?: (url: string) => boolean;
  shouldCrawlLinksFrom?: (url: string) => boolean;
  selector?: string;
  headers?: Record<string, string>;
  respectRobotsTxt?: boolean;
  debug?: boolean;
}

export interface CrawlCallbackOptions {
  url: string;
  success?: (page: CrawlPage) => void;
  failure?: (page: CrawlPage) => void;
  finished?: (crawledUrls: string[]) => void;
}

export interface CrawlerEvents {
  page: (page: CrawlPage) => void;
  error: (page: CrawlPage) => void;
  finished: (crawledUrls: string[]) => void;
}

export interface CrawlerState {
  visitedUrls: string[];
  crawledUrls: string[];
  options: CrawlerOptions;
}
