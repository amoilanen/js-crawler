import * as _ from 'underscore';
import Executor from './src/executor';
import Request, {RequestSuccess, RequestFailure} from './src/request';
import Response, { CrawlOptions } from './src/response';
import Configuration from './src/configuration';

/*
 * Main crawler functionality.
 */
function Crawler() {

  /*
   * Urls that the Crawler has visited, as some pages may be in the middle of a redirect chain, not all the knownUrls will be actually
   * reported in the onSuccess or onFailure callbacks, only the final urls in the corresponding redirect chains
   */
  this.knownUrls = {};

  /*
   * Urls that were reported in the onSuccess or onFailure callbacks. this.crawledUrls is a subset of this.knownUrls, and matches it
   * iff there were no redirects while crawling.
   */
  this.crawledUrls = [];
  //Urls that are queued for crawling, for some of them HTTP requests may not yet have been issued
  this._currentUrlsToCrawl = [];
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

/*
 * TODO: forgetCrawled, _startedCrawling, _finishedCrawling, _requestUrl belong together?
 * Group them together?
 */
Crawler.prototype.forgetCrawled = function() {
  this.knownUrls = {};
  this.crawledUrls = [];
  return this;
};

Crawler.prototype._startedCrawling = function(url) {
  if (this._currentUrlsToCrawl.indexOf(url) < 0) {
    this._currentUrlsToCrawl.push(url);
  }
};

Crawler.prototype._finishedCrawling = function(url) {
  //console.log("Finished crawling url = ", url);
  //console.log("_currentUrlsToCrawl = ", this._currentUrlsToCrawl);
  var indexOfUrl = this._currentUrlsToCrawl.indexOf(url);

  this._currentUrlsToCrawl.splice(indexOfUrl, 1);
  if (this._currentUrlsToCrawl.length === 0) {
    //console.log("Crawling finished!");
    this.configuration.options.onAllFinished(this.crawledUrls);
    this.workExecutor.stop();
  }
}

Crawler.prototype._shouldSkip = function(url) {
  //console.log('Should skip? url = ', url, _.contains(_.keys(self.knownUrls), url) || !self.shouldCrawl(url));
  var shouldCrawlUrl = this.configuration.options.shouldCrawl(url);
  if (!shouldCrawlUrl) {
    this._finishedCrawling(url);
  }
  return _.contains(_.keys(this.knownUrls), url) || !shouldCrawlUrl;
}

Crawler.prototype._crawlUrl = function(url, referer, depth) {

  //console.log('_crawlUrl: url = %s, depth = %s', url, depth);
  if ((depth === 0) || this.knownUrls[url]) {
    return;
  }
  //Do not request a url if it has already been crawled
  if (_.contains(this._currentUrlsToCrawl, url) || _.contains(_.keys(this.knownUrls), url)) {
    return;
  }
  this._startedCrawling(url);

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
      if (this.knownUrls[url]) {
        //Was already crawled while the request has been processed, no need to call callbacks
        return;
      }
      _.each(success.visitedUrls, (url: string) => {
        this.knownUrls[url] = true;
      });

      const resp = new Response(success.response);
      const body = resp.getBody();
      if (this.configuration.options.shouldCrawl(success.lastVisitedUrl)) {
        this.configuration.options.onSuccess({
          url: success.lastVisitedUrl,
          status: success.response.statusCode,
          content: body,
          error: null,
          response: success.response,
          body: body,
          referer: referer || ""
        });
        this.knownUrls[success.lastVisitedUrl] = true;
        this.crawledUrls.push(success.lastVisitedUrl);
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
      this.configuration.options.onFailure({
        url: url,
        status: failure.response ? failure.response.statusCode : undefined,
        content: body,
        error: failure.error,
        response: failure.response,
        body: body,
        referer: referer || ""
      });
      this.crawledUrls.push(url);
    }).then(() => {
      this._finishedCrawling(url);
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
