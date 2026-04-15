import { EventEmitter } from 'events';
import type {
  CrawlerOptions,
  CrawlerState,
  CrawlPage,
  CrawlCallbackOptions,
  HttpResponse,
} from './types.js';
import Configuration, {
  type SuccessCallback,
  type FailureCallback,
  type FinishedCallback,
} from './configuration.js';
import State from './state.js';
import Executor from './executor.js';
import { makeRequest } from './request.js';
import {
  isHtmlContent,
  isTextContent,
  decodeBody,
  extractUrls,
} from './response.js';
import { RobotsCache } from './robots.js';

export default class Crawler extends EventEmitter {
  private configuration: Configuration;
  private state: State;
  private executor: Executor | null = null;
  private robotsCache: RobotsCache | null = null;
  private abortController: AbortController | null = null;
  private crawlPromiseResolve: ((urls: string[]) => void) | null = null;
  private pageCount = 0;
  private finished = false;

  constructor() {
    super();
    this.configuration = new Configuration();
    this.state = new State({
      onCrawlingFinished: (crawledUrls: string[]) => {
        this.onFinished(crawledUrls);
      },
    });
  }

  configure(options: CrawlerOptions): this {
    this.configuration.configure(options);
    return this;
  }

  crawl(url: string): Promise<string[]>;
  crawl(
    url: string,
    onSuccess?: SuccessCallback,
    onFailure?: FailureCallback,
    onFinished?: FinishedCallback,
  ): this;
  crawl(options: CrawlCallbackOptions): this;
  crawl(
    urlOrOptions: string | CrawlCallbackOptions,
    onSuccess?: SuccessCallback,
    onFailure?: FailureCallback,
    onFinished?: FinishedCallback,
  ): this | Promise<string[]> {
    const url = this.configuration.updateAndReturnUrl(
      urlOrOptions,
      onSuccess,
      onFailure,
      onFinished,
    );

    this.pageCount = 0;
    this.finished = false;
    this.abortController = new AbortController();

    const options = this.configuration.options;

    this.executor = new Executor({
      maxRatePerSecond: options.maxRequestsPerSecond!,
      maxConcurrentTasks: options.maxConcurrentRequests!,
    });
    this.executor.start();

    if (options.respectRobotsTxt) {
      this.robotsCache = new RobotsCache({
        userAgent: options.userAgent!,
      });
    } else {
      this.robotsCache = null;
    }

    // Determine if we're using Promise API (no callbacks provided)
    const hasCallbacks =
      typeof urlOrOptions !== 'string' ||
      onSuccess !== undefined ||
      onFinished !== undefined;

    if (hasCallbacks) {
      this.crawlUrl(url, '', options.depth!);
      return this;
    }

    return new Promise<string[]>((resolve) => {
      this.crawlPromiseResolve = resolve;
      this.crawlUrl(url, '', options.depth!);
    });
  }

  stop(): void {
    this.debug('stop() called');
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.executor) {
      this.executor.stop();
    }
    const crawledUrls = [...this.state.crawledUrls];
    this.onFinished(crawledUrls);
  }

  forgetCrawled(): void {
    this.state.clear();
    if (this.robotsCache) {
      this.robotsCache.clear();
    }
  }

  freeze(): CrawlerState {
    const stateData = this.state.freeze();
    return {
      visitedUrls: stateData.visitedUrls,
      crawledUrls: stateData.crawledUrls,
      options: { ...this.configuration.options },
    };
  }

  defrost(crawlerState: CrawlerState): void {
    this.state.defrost({
      visitedUrls: crawlerState.visitedUrls,
      crawledUrls: crawlerState.crawledUrls,
    });
    if (crawlerState.options) {
      this.configuration.configure(crawlerState.options);
    }
  }

  private onFinished(crawledUrls: string[]): void {
    if (this.finished) return;
    this.finished = true;
    this.debug(`Crawling finished, ${crawledUrls.length} URLs crawled`);
    this.configuration.callbacks.finished(crawledUrls);
    this.emit('finished', crawledUrls);
    if (this.crawlPromiseResolve) {
      this.crawlPromiseResolve(crawledUrls);
      this.crawlPromiseResolve = null;
    }
    if (this.executor) {
      this.executor.stop();
      this.executor = null;
    }
  }

  private crawlUrl(url: string, referer: string, depth: number): void {
    if (this.isAborted()) return;

    if (this.state.isVisitedUrl(url) || this.state.isBeingCrawled(url)) {
      this.checkFinished();
      return;
    }

    if (depth === 0) {
      this.checkFinished();
      return;
    }

    if (this.isMaxPagesReached()) {
      this.checkFinished();
      return;
    }

    const options = this.configuration.options;
    if (!options.shouldCrawl!(url)) {
      this.checkFinished();
      return;
    }

    this.state.startedCrawling(url);
    this.debug(`Queuing: ${url} (depth=${depth}, referer=${referer})`);

    this.executor!.submit(async () => {
      if (this.isAborted() || this.state.isVisitedUrl(url)) {
        this.state.finishedCrawling(url);
        return;
      }

      // Check robots.txt
      if (this.robotsCache) {
        const allowed = await this.robotsCache.isAllowed(url);
        if (!allowed) {
          this.debug(`Blocked by robots.txt: ${url}`);
          this.state.finishedCrawling(url);
          return;
        }
      }

      try {
        const response = await makeRequest({
          url,
          referer,
          userAgent: options.userAgent!,
          headers: options.headers,
          requestTimeout: options.requestTimeout,
          maxRetries: options.maxRetries,
          retryDelay: options.retryDelay,
          signal: this.abortController?.signal,
        });

        if (this.isAborted() || this.state.isVisitedUrl(url)) {
          this.state.finishedCrawling(url);
          return;
        }

        // Remember all visited URLs (including redirects)
        const allVisitedUrls = [...response.redirectUrls, response.url];
        this.state.rememberVisitedUrls(allVisitedUrls);

        const finalUrl = response.url;
        const body = decodeBody(response);

        if (this.isMaxPagesReached()) {
          this.state.finishedCrawling(url);
          return;
        }

        const page: CrawlPage = {
          url: finalUrl,
          status: response.statusCode,
          content: body,
          error: null,
          response,
          body,
          referer: referer || '',
        };

        this.pageCount++;
        this.configuration.callbacks.success(page);
        this.emit('page', page);
        this.state.rememberCrawledUrl(finalUrl);

        this.debug(`Crawled: ${finalUrl} (status=${response.statusCode})`);

        // Extract and follow links if HTML and depth allows
        if (
          depth > 1 &&
          isHtmlContent(response) &&
          options.shouldCrawlLinksFrom!(finalUrl) &&
          !this.isMaxPagesReached()
        ) {
          const links = extractUrls(response, {
            ignoreRelative: options.ignoreRelative,
            shouldCrawl: options.shouldCrawl,
            selector: options.selector,
          });
          this.debug(`Found ${links.length} links on ${finalUrl}`);
          for (const link of links) {
            if (!this.isAborted() && !this.isMaxPagesReached()) {
              this.crawlUrl(link, finalUrl, depth - 1);
            }
          }
        }
      } catch (err) {
        if (this.isAborted()) {
          this.state.finishedCrawling(url);
          return;
        }

        const error = err as Error;
        this.debug(`Error crawling ${url}: ${error.message}`);

        const errorResponse: HttpResponse = {
          headers: {},
          body: Buffer.alloc(0),
          statusCode: 0,
          url,
          redirectUrls: [],
        };

        const page: CrawlPage = {
          url,
          status: 0,
          content: '',
          error,
          response: errorResponse,
          body: '',
          referer: referer || '',
        };

        this.configuration.callbacks.failure(page);
        this.emit('error', page);
        this.state.rememberCrawledUrl(url);
      } finally {
        this.state.finishedCrawling(url);
      }
    });
  }

  private checkFinished(): void {
    if (this.state.isFinished()) {
      this.onFinished([...this.state.crawledUrls]);
    }
  }

  private isAborted(): boolean {
    return this.abortController?.signal.aborted ?? false;
  }

  private isMaxPagesReached(): boolean {
    const maxPages = this.configuration.options.maxPages;
    return maxPages !== undefined && this.pageCount >= maxPages;
  }

  private debug(message: string): void {
    if (this.configuration.options.debug) {
      console.log(`[js-crawler] ${message}`);
    }
  }
}
