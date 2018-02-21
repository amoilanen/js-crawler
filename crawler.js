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
    _.each(self._redirects, function(redirect) {
      self.knownUrls[redirect.redirectUri] = true;
    });
    //console.log('analyzing url = ', url);
    var isTextContent = self._isTextContent(response);
    var body = isTextContent ? self._getDecodedBody(response) : '<<...binary content (omitted by js-crawler)...>>';

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
          self._crawlUrls(self._getAllUrls(lastUrlInRedirectChain, body), lastUrlInRedirectChain, depth - 1);
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

Crawler.prototype._isTextContent = function(response) {
  return Boolean(response && response.headers && response.headers['content-type']
      && response.headers['content-type'].match(/^text\/html.*$/));
};

Crawler.prototype._getDecodedBody = function(response) {
  var defaultEncoding = 'utf8';
  var encoding = defaultEncoding;

  if (response.headers['content-encoding']) {
    encoding = response.headers['content-encoding'];
  }
  //console.log('encoding = "' + encoding + '"');
  var decodedBody;
  try {
    decodedBody = response.body.toString(encoding);
  } catch (decodingError) {
    decodedBody = response.body.toString(defaultEncoding);
  }
  return decodedBody;
};

Crawler.prototype._stripComments = function(str) {
  return str.replace(/<!--.*?-->/g, '');
};

Crawler.prototype._getBaseUrl = function(defaultBaseUrl, body) {

  /*
   * Resolving the base url following
   * the algorithm from https://www.w3.org/TR/html5/document-metadata.html#the-base-element
   */
  var baseUrlRegex = /<base href="(.*?)">/;
  var baseUrlInPage = body.match(baseUrlRegex);
  if (!baseUrlInPage) {
    return defaultBaseUrl;
  }

  return url.resolve(defaultBaseUrl, baseUrlInPage[1]);
};

Crawler.prototype._isLinkProtocolSupported = function(link) {
  return (link.indexOf('://') < 0 && link.indexOf('mailto:') < 0)
    || link.indexOf('http://') >= 0 || link.indexOf('https://') >= 0;
};

Crawler.prototype._getAllUrls = function(defaultBaseUrl, body) {
  var self = this;
  body = this._stripComments(body);
  var baseUrl = this._getBaseUrl(defaultBaseUrl, body);
  var linksRegex = self.ignoreRelative ? /<a[^>]+?href=["'].*?:\/\/.*?["']/gmi : /<a[^>]+?href=["'].*?["']/gmi;
  var links = body.match(linksRegex) || [];

  //console.log('body = ', body);
  var urls = _.chain(links)
    .map(function(link) {
      var match = /href=[\"\'](.*?)[#\"\']/i.exec(link);

      link = match[1];
      link = url.resolve(baseUrl, link);
      return link;
    })
    .uniq()
    .filter(function(link) {
      return self._isLinkProtocolSupported(link) && self.shouldCrawl(link);
     })
    .value();

  //console.log('urls to crawl = ', urls);
  return urls;
};

Crawler.prototype._crawlUrls = function(urls, referer, depth) {
  var self = this;

  _.each(urls, function(url) {
    self._crawlUrl(url, referer, depth);
  });
};

module.exports = Crawler;
