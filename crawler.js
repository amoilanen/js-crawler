var request = require("request");
var _ = require("underscore");
var url = require('url');

var DEFAULT_DEPTH = 2;

function Crawler() {
  this.crawledUrls = {};
  this.depth = DEFAULT_DEPTH;
  this.ignoreRelative = false;
  this._beingCrawled = [];
  this.shouldCrawl = function() {
    return true;
  };
}

Crawler.prototype.configure = function(options) {
  this.depth = (options && options.depth) || this.depth;
  this.depth = Math.max(this.depth, 0);
  this.ignoreRelative = (options && options.ignoreRelative) || this.ignoreRelative;
  this.shouldCrawl = (options && options.shouldCrawl) || this.shouldCrawl;
  return this;
};

Crawler.prototype.crawl = function(url, onSuccess, onFailure, onAllFinished) {
  if (!(typeof url === "string")) {
    var options = url;

    this._crawlUrl(options.url, this.depth,  options.success, options.failure, options.finished);
  } else {
    this._crawlUrl(url, this.depth, onSuccess, onFailure, onAllFinished);
  }
  return this;
};

Crawler.prototype._startedCrawling = function(url) {
  this._beingCrawled.push(url);
};

Crawler.prototype.forgetCrawled = function() {
  this.crawledUrls = {};
  return this;
};

Crawler.prototype._finishedCrawling = function(url, onAllFinished) {
  var indexOfUrl = this._beingCrawled.indexOf(url);

  this._beingCrawled.splice(indexOfUrl, 1);
  if ((this._beingCrawled.length === 0) && onAllFinished) {
    onAllFinished(_.keys(this.crawledUrls));
  }
}

Crawler.prototype._crawlUrl = function(url, depth, onSuccess, onFailure, onAllFinished) {
  if (0 == depth || this.crawledUrls[url]) {
    return;
  }
  var self = this;

  this._startedCrawling(url);
  request(url, function(error, response, body) {
    self.crawledUrls[url] = true;
    if (!error && response.statusCode == 200) {
      onSuccess({
        url: url,
        status: response.statusCode,
        content: body,
        error: error,
        response: response,
        body: body
      });
      self._crawlUrls(self._getAllUrls(url, body), depth - 1, onSuccess, onFailure, onAllFinished);
      self._finishedCrawling(url, onAllFinished);
    } else if (onFailure) {
      onFailure({
        url: url,
        status: response ? response.statusCode : undefined,
        error: error,
        response: response,
        body: body
      });
      self._finishedCrawling(url, onAllFinished);
    }
  });
};

Crawler.prototype._getAllUrls = function(baseUrl, body) {
  var self = this;
  var linksRegex = self.ignoreRelative ? /<a[^>]+?href=".*?:\/\/.*?"/gm : /<a[^>]+?href=".*?"/gm;
  var links = body.match(linksRegex) || [];

  links = _.map(links, function(link) {
    var match = /href=\"(.*?)[#\"]/.exec(link);

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