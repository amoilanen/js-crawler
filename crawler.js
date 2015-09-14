var request = require('request');
var _ = require('underscore');
var url = require('url');

var DEFAULT_DEPTH = 2;
var DEFAULT_MAX_CONCURRENT_REQUESTS = 10;
var DEFAULT_MAX_REQUESTS_PER_SECOND = 100;
var DEFAULT_USERAGENT = 'crawler/js-crawler';

/*
 * Executor that handles throttling and task processing rate.
 */
function Executor(opts) {
  this.maxRatePerSecond = opts.maxRatePerSecond;
  this.onFinished = opts.finished || function() {};
  this.canProceed = opts.canProceed || function() {return true;};
  this.queue = [];
  this.isStopped = false;
  this.timeoutMs = (1 / this.maxRatePerSecond) * 1000;
}

Executor.prototype.submit = function(func, context, args, shouldSkip) {
  this.queue.push({
    func: func,
    context: context,
    args: args,
    shouldSkip: shouldSkip
  });
};

Executor.prototype.start = function() {
  this._processQueueItem();
};

Executor.prototype.stop = function() {
  this.isStopped = true;
};

Executor.prototype._processQueueItem = function() {
  var self = this;

  if (this.canProceed()) {
    if (this.queue.length !== 0) {
      var nextExecution = this.queue.shift();
      var shouldSkipNext = (nextExecution.shouldSkip && nextExecution.shouldSkip.call(nextExecution.context));

      if (shouldSkipNext) {
        setTimeout(function() {
          self._processQueueItem();
        });
        return;
      } else {
        nextExecution.func.apply(nextExecution.context, nextExecution.args);
      }
    }
  }
  if (this.isStopped) {
    return;
  }
  setTimeout(function() {
    self._processQueueItem();
  }, this.timeoutMs);
};

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
  this.shouldCrawl = function() {
    return true;
  };
  //Urls that are queued for crawling, for some of them HTTP requests may not yet have been issued
  this._currentUrlsToCrawl = [];
  this._concurrentRequestNumber = 0;
}

Crawler.prototype.configure = function(options) {
  this.depth = (options && options.depth) || this.depth;
  this.depth = Math.max(this.depth, 0);
  this.ignoreRelative = (options && options.ignoreRelative) || this.ignoreRelative;
  this.userAgent = (options && options.userAgent) || this.userAgent;
  this.maxConcurrentRequests = (options && options.maxConcurrentRequests) || this.maxConcurrentRequests;
  this.maxRequestsPerSecond = (options && options.maxRequestsPerSecond) || this.maxRequestsPerSecond;
  this.shouldCrawl = (options && options.shouldCrawl) || this.shouldCrawl;
  return this;
};

Crawler.prototype.crawl = function(url, onSuccess, onFailure, onAllFinished) {
  var self = this;

  this.workExecutor = new Executor({
    maxRatePerSecond: this.maxRequestsPerSecond,
    canProceed: function() {
      var shouldProceed = (self._concurrentRequestNumber < self.maxConcurrentRequests);

      return shouldProceed;
    }
  });
  this.workExecutor.start();
  if (!(typeof url === 'string')) {
    var options = url;

    this._crawlUrl(options.url, this.depth, options.success, options.failure, options.finished);
  } else {
    this._crawlUrl(url, this.depth, onSuccess, onFailure, onAllFinished);
  }
  return this;
};

Crawler.prototype._startedCrawling = function(url) {
  this._currentUrlsToCrawl.push(url);
};

Crawler.prototype.forgetCrawled = function() {
  this.knownUrls = {};
  this.crawledUrls = [];
  return this;
};

Crawler.prototype._finishedCrawling = function(url, onAllFinished) {
  var indexOfUrl = this._currentUrlsToCrawl.indexOf(url);

  this._currentUrlsToCrawl.splice(indexOfUrl, 1);
  if (this._currentUrlsToCrawl.length === 0) {
    onAllFinished && onAllFinished(this.crawledUrls);
    this.workExecutor && this.workExecutor.stop();
  }
}

Crawler.prototype._requestUrl = function(options, callback) {
  var self = this;

  this.workExecutor.submit(function(options, callback) {
    self._concurrentRequestNumber++;
    request(options, callback);
  }, null, [options, callback], function shouldSkip() {
    var url = options.url;
    var willSkip = _.contains(self.knownUrls, url) || !self.shouldCrawl(url);

    if (willSkip && _.contains(self._currentUrlsToCrawl, url)) {
      self._finishedCrawling(url, onAllFinished);
    }
    return willSkip;
  });
};

Crawler.prototype._crawlUrl = function(url, depth, onSuccess, onFailure, onAllFinished) {
  if ((depth === 0) || this.knownUrls[url]) {
    return;
  }
  var self = this;

  this._startedCrawling(url);
  this._requestUrl({
    url: url,
    rejectUnauthorized : false,
    headers: {
      'User-Agent': this.userAgent
    }
  }, function(error, response, body) {
    if (!error && (response.statusCode === 200)) {
      //If no redirects, then response.request.uri.href === url, otherwise last url
      var lastUrlInRedirectChain = response.request.uri.href;
      if (self.shouldCrawl(lastUrlInRedirectChain)) {
        self.knownUrls[url] = true;
        _.each(this.redirects, function(redirect) {
          self.knownUrls[redirect.redirectUri] = true;
        });
        onSuccess({
          url: url,
          status: response.statusCode,
          content: body,
          error: error,
          response: response,
          body: body
        });
        self.crawledUrls.push(lastUrlInRedirectChain);
        if (depth > 1) {
          self._crawlUrls(self._getAllUrls(lastUrlInRedirectChain, body), depth - 1, onSuccess, onFailure, onAllFinished);
        }
      }
    } else if (onFailure) {
      onFailure({
        url: url,
        status: response ? response.statusCode : undefined,
        error: error,
        response: response,
        body: body
      });
      self.crawledUrls.push(url);
    }
    self._concurrentRequestNumber--;
    self._finishedCrawling(url, onAllFinished);
  });
};

Crawler.prototype._getAllUrls = function(baseUrl, body) {
  var self = this;
  var linksRegex = self.ignoreRelative ? /<a[^>]+?href=".*?:\/\/.*?"/gmi : /<a[^>]+?href=".*?"/gmi;
  var links = body.match(linksRegex) || [];

  links = _.map(links, function(link) {
    var match = /href=\"(.*?)[#\"]/i.exec(link);

    link = match[1];
    link = url.resolve(baseUrl, link);
    return link;
  });
  return _.chain(links)
    .uniq()
    .filter(this.shouldCrawl)
    .value();
};

Crawler.prototype._crawlUrls = function(urls, depth, onSuccess, onFailure, onAllFinished) {
  var self = this;

  _.each(urls, function(url) {
    self._crawlUrl(url, depth, onSuccess, onFailure, onAllFinished);
  });
};

module.exports = Crawler;