import * as _ from 'underscore';
import Executor from './src/executor';
import Request, {RequestSuccess, RequestFailure} from './src/request';
import Response, { CrawlOptions } from './src/response';
import Configuration from './src/configuration';
import State from './src/state';

function Crawler() {
  this.state = new State({
    onCrawlingFinished: (urls: string[]) => {
      this.configuration.callbacks.finished(urls);
      this.workExecutor.stop();
    }
  });
  this.configuration = new Configuration();
}

Crawler.prototype.configure = function(options) {
  this.configuration.configure(options);
  return this;
};

Crawler.prototype._createExecutor = function() {
  return new Executor({
    maxRatePerSecond: this.configuration.options.maxRequestsPerSecond,
    maxConcurrentTasks: this.configuration.options.maxConcurrentRequests
  });
};

Crawler.prototype.crawl = function(urlOrOptions, onSuccess, onFailure, onAllFinished) {
  this.workExecutor = this._createExecutor();
  this.workExecutor.start();
  const url = this.configuration.updateAndReturnUrl(urlOrOptions, onSuccess, onFailure, onAllFinished);
  this._crawlUrl(url, null, this.configuration.options.depth);
  return this;
};

Crawler.prototype.forgetCrawled = function() {
  this.state.clear();
};

Crawler.prototype._shouldSkip = function(url) {
  var shouldCrawlUrl = this.configuration.options.shouldCrawl(url);
  if (!shouldCrawlUrl) {
    this.state.finishedCrawling(url);
  }
  return this.state.isVisitedUrl(url) || !shouldCrawlUrl;
}

Crawler.prototype._crawlUrl = function(url, referer, depth) {

  //console.log('_crawlUrl: url = %s, depth = %s', url, depth);
  if ((depth === 0) || this.state.isVisitedUrl(url) || this.state.isBeingCrawled(url)) {
    return;
  }
  this.state.startedCrawling(url);

  this.workExecutor.submit(() => {

    if (this._shouldSkip(url)) {
      return Promise.resolve();
    }

    const req = new Request({
      referer,
      url,
      userAgent: this.configuration.options.userAgent
    });
    return req.submit().then((success: RequestSuccess) => {

      if (this.state.isVisitedUrl(url)) {
        //Was already crawled while the request has been processed, no need to call callbacks
        return;
      }
      this.state.addVisitedUrls(success.visitedUrls);

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
        this.state.addCrawledUrl(success.lastVisitedUrl);
        if (this.configuration.options.shouldCrawlLinksFrom(success.lastVisitedUrl) && depth > 1 && resp.isTextHtml()) {
          //TODO: If is not textContent just return the empty list of urls in the Response implementation
          const crawlOptions = {
            ignoreRelative: this.configuration.options.ignoreRelative,
            shouldCrawl: this.configuration.options.shouldCrawl
          };
          this._crawlUrls(resp.getAllUrls(success.lastVisitedUrl, body, crawlOptions), success.lastVisitedUrl, depth - 1);
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
      this.state.addCrawledUrl(url);
    }).then(() => {
      this.state.finishedCrawling(url);
    });
  });
};

Crawler.prototype._crawlUrls = function(urls, referer, depth) {
  var self = this;

  _.each(urls, function(url) {
    self._crawlUrl(url, referer, depth);
  });
};

module.exports = Crawler;
