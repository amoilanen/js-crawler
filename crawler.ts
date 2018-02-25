const request = require('request');
import * as _ from 'underscore';
import Executor from './src/executor';
import Response from './src/response';

const DEFAULT_DEPTH = 2;
const DEFAULT_MAX_CONCURRENT_REQUESTS = 10;
const DEFAULT_MAX_REQUESTS_PER_SECOND = 100;
const DEFAULT_USERAGENT = 'crawler/js-crawler';

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
  this.depth = DEFAULT_DEPTH;
  this.ignoreRelative = false;
  this.userAgent = DEFAULT_USERAGENT;
  this.maxConcurrentRequests = DEFAULT_MAX_CONCURRENT_REQUESTS;
  this.maxRequestsPerSecond = DEFAULT_MAX_REQUESTS_PER_SECOND;
  this.shouldCrawl = function(url) {
    return true;
  };
  this.shouldCrawlLinksFrom = function(url) {
    return true;
  };
  //Urls that are queued for crawling, for some of them HTTP requests may not yet have been issued
  this._currentUrlsToCrawl = [];
  this._concurrentRequestNumber = 0;

  //Injecting request as a dependency for unit test support
  this.request = request;
}

Crawler.prototype.configure = function(options) {
  this.depth = (options && options.depth) || this.depth;
  this.depth = Math.max(this.depth, 0);
  this.ignoreRelative = (options && options.ignoreRelative) || this.ignoreRelative;
  this.userAgent = (options && options.userAgent) || this.userAgent;
  this.maxConcurrentRequests = (options && options.maxConcurrentRequests) || this.maxConcurrentRequests;
  this.maxRequestsPerSecond = (options && options.maxRequestsPerSecond) || this.maxRequestsPerSecond;
  this.shouldCrawl = (options && options.shouldCrawl) || this.shouldCrawl;
  this.shouldCrawlLinksFrom = (options && options.shouldCrawlLinksFrom) || this.shouldCrawlLinksFrom;
  this.onSuccess = _.noop;
  this.onFailure = _.noop;
  this.onAllFinished = _.noop;
  return this;
};

Crawler.prototype._createExecutor = function() {
  var self = this;

  return new Executor({
    maxRatePerSecond: this.maxRequestsPerSecond,
    canProceed: function() {
      return self._concurrentRequestNumber < self.maxConcurrentRequests;
    }
  });
};

Crawler.prototype.crawl = function(url, onSuccess, onFailure, onAllFinished) {
  this.workExecutor = this._createExecutor();
  this.workExecutor.start();

  if (typeof url !== 'string') {
    var options = url;

    onSuccess = options.success;
    onFailure = options.failure;
    onAllFinished = options.finished;
    url = options.url;
  }
  this.onSuccess = onSuccess;
  this.onFailure = onFailure;
  this.onAllFinished = onAllFinished;
  this._crawlUrl(url, null, this.depth);

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
  var indexOfUrl = this._currentUrlsToCrawl.indexOf(url);

  this._currentUrlsToCrawl.splice(indexOfUrl, 1);
  if (this._currentUrlsToCrawl.length === 0) {
    this.onAllFinished && this.onAllFinished(this.crawledUrls);
    this.workExecutor && this.workExecutor.stop();
  }
}

Crawler.prototype._requestUrl = function(options, callback) {
  //console.log('_requestUrl: options = ', options);
  var self = this;
  var url = options.url;

  //Do not request a url if it has already been crawled
  if (_.contains(self._currentUrlsToCrawl, url) || _.contains(_.keys(self.knownUrls), url)) {
    return;
  }

  self._startedCrawling(url);
  this.workExecutor.submit(function(options, callback) {
    self._concurrentRequestNumber++;
    self.request(options, function(error, response, body) {
      self._redirects = this._redirect.redirects;
      callback(error, response, body);
      self._finishedCrawling(url);
      self._concurrentRequestNumber--;
    });
  }, null, [options, callback], function shouldSkip() {
    //console.log('Should skip? url = ', url, _.contains(_.keys(self.knownUrls), url) || !self.shouldCrawl(url));
    var shouldCrawlUrl = self.shouldCrawl(url);
    if (!shouldCrawlUrl) {
      self._finishedCrawling(url);
    }
    return _.contains(_.keys(self.knownUrls), url) || !shouldCrawlUrl;
  });
};

Crawler.prototype._crawlUrl = function(url, referer, depth) {
  //console.log('_crawlUrl: url = %s, depth = %s', url, depth);
  if ((depth === 0) || this.knownUrls[url]) {
    return;
  }

  var self = this;

  this._requestUrl({
    url: url,
    encoding: null, // Added by @tibetty so as to avoid request treating body as a string by default
    rejectUnauthorized : false,
    followRedirect: true,
    followAllRedirects: true,
    headers: {
      'User-Agent': this.userAgent,
      'Referer': referer
    }
  }, function(error, response) {
    if (self.knownUrls[url]) {
      //Was already crawled while the request has been processed, no need to call callbacks
      return;
    }
    self.knownUrls[url] = true;
    _.each(self._redirects, (redirect: any) => {
      self.knownUrls[redirect.redirectUri] = true;
    });
    //console.log('analyzing url = ', url);
    const resp = new Response(response);

    var isTextContent = resp.isTextHtml();
    var body = resp.getBody();

    if (!error && (response.statusCode === 200)) {
      //If no redirects, then response.request.uri.href === url, otherwise last url
      var lastUrlInRedirectChain = response.request.uri.href;
      //console.log('lastUrlInRedirectChain = %s', lastUrlInRedirectChain);
      if (self.shouldCrawl(lastUrlInRedirectChain)) {
        self.onSuccess({
          url: lastUrlInRedirectChain,
          status: response.statusCode,
          content: body,
          error: error,
          response: response,
          body: body,
          referer: referer || ""
        });
        self.knownUrls[lastUrlInRedirectChain] = true;
        self.crawledUrls.push(lastUrlInRedirectChain);
        if (self.shouldCrawlLinksFrom(lastUrlInRedirectChain) && depth > 1 && isTextContent) {
          //TODO: If is not textContent just return the empty list of urls in the Respone implementation
          const crawlOptions = {
            ignoreRelative: self.ignoreRelative,
            shouldCrawl: self.shouldCrawl
          };
          self._crawlUrls(resp.getAllUrls(lastUrlInRedirectChain, body, crawlOptions), lastUrlInRedirectChain, depth - 1);
        }
      }
    } else if (self.onFailure) {
      self.onFailure({
        url: url,
        status: response ? response.statusCode : undefined,
        content: body,
        error: error,
        response: response,
        body: body,
        referer: referer || ""
      });
      self.crawledUrls.push(url);
    }
  });
};

Crawler.prototype._crawlUrls = function(urls, referer, depth) {
  var self = this;

_.each(urls, function(url) {
  self._crawlUrl(url, referer, depth);
});

};

module.exports = Crawler;
