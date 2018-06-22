import AsynchronousExecutor, { Executor } from './src/executor';
import DefaultRequest, { Request, RequestSuccess, RequestFailure } from './src/request';
import Response, { UrlCrawlingBehavior } from './src/response';
import Configuration,
  { ConfigurationOptions, CrawlCallbacks, SuccessCallback,
    FailureCallback, FinishedCallback } from './src/configuration';
import State from './src/state';

export default class Crawler {
  state: State
  configuration: Configuration
  workExecutor: Executor

  constructor() {
    this.state = new State({
      onCrawlingFinished: (urls: string[]) => {
        this.configuration.callbacks.finished(urls);
        this.workExecutor.stop();
      }
    });
    this.configuration = new Configuration();
  }

  createExecutor(): Executor {
    return new AsynchronousExecutor({
      maxRatePerSecond: this.configuration.options.maxRequestsPerSecond,
      maxConcurrentTasks: this.configuration.options.maxConcurrentRequests
    });
  }

  createRequest(referer: string, url: string): Request {
    return new DefaultRequest({
      referer,
      url,
      userAgent: this.configuration.options.userAgent
    });
  }

  configure(options: ConfigurationOptions): Crawler {
    this.configuration.configure(options);
    return this;
  }

  crawl(urlOrOptions: CrawlCallbacks & { url: string},
      onSuccess?: SuccessCallback,
      onFailure?: FailureCallback,
      onAllFinished?: FinishedCallback): Crawler {
    this.workExecutor = this.createExecutor();
    this.workExecutor.start();
    const url = this.configuration.updateAndReturnUrl(urlOrOptions, onSuccess, onFailure, onAllFinished);
    this.crawlUrl(url, null, this.configuration.options.depth);
    return this;
  }

  forgetCrawled(): void {
    this.state.clear();
  }

  crawlUrl(url: string, referer: string, depth: number): void {
      //console.log('_crawlUrl: url = %s, depth = %s', url, depth);
      if (this.state.isVisitedUrl(url) || this.state.isBeingCrawled(url)) {
        return;
      }
      if (depth === 0) {
        this.state.finishedCrawling();
        return;
      }
      this.state.startedCrawling(url);
    
      this.workExecutor.submit(() => {
    
        if (this.state.isVisitedUrl(url) || !this.configuration.options.shouldCrawl(url)) {
          this.state.finishedCrawling(url);
          return Promise.resolve();
        }

        return this.createRequest(referer, url).submit()
            .then((success: RequestSuccess) => {
    
          if (this.state.isVisitedUrl(url)) {
            //Was already crawled while the request has been processed, no need to call callbacks
            return;
          }
          this.state.rememberVisitedUrls(success.visitedUrls);

          const resp = new Response(success.response);
          const body = resp.getBody();
          if (this.configuration.options.shouldCrawl(success.lastVisitedUrl)) {
            this.configuration.callbacks.success({
              url: success.lastVisitedUrl,
              status: success.response.statusCode,
              content: body,
              error: null,
              response: success.response,
              body: body,
              referer: referer || ""
            });
            this.state.rememberCrawledUrl(success.lastVisitedUrl);
            if (this.configuration.options.shouldCrawlLinksFrom(success.lastVisitedUrl) && depth > 1) {
              const nextUrlsToCrawl = resp.getAllUrls(success.lastVisitedUrl, body, this.configuration.crawlingBehavior);

              this.crawlUrls(nextUrlsToCrawl, success.lastVisitedUrl, depth - 1);
            }
          }
        }).catch((failure: RequestFailure) => {
          const resp = new Response(failure.response);
          const body = resp.getBody();
          this.configuration.callbacks.failure({
            url: url,
            status: failure.response ? failure.response.statusCode : undefined,
            content: body,
            error: failure.error,
            response: failure.response,
            body: body,
            referer: referer || ""
          });
          this.state.rememberCrawledUrl(url);
        }).then(() => {
          this.state.finishedCrawling(url);
        });
      });
    }

  crawlUrls(urls: string[], referer: string, depth: number): void {
    urls.forEach(url =>
      this.crawlUrl(url, referer, depth)
    );
  }
}