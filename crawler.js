var request = require("request");
var _ = require("underscore");

var DEFAULT_DEPTH = 2;

function Crawler() {
  this.visitedURLs = {};
  this.depth = DEFAULT_DEPTH;
  this.ignoreRelative = false;
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

Crawler.prototype.crawl = function (url, onSuccess, onFailure) {
  this.crawlUrl(url, this.depth, onSuccess, onFailure);
};

Crawler.prototype.crawlUrl = function(url, depth, onSuccess, onFailure) {
  if (0 == depth || this.visitedURLs[url]) {
    return;
  }
  var self = this;

  request(url, function(error, response, body) {
    if (!error && response.statusCode == 200) {
      self.visitedURLs[url] = true;
      onSuccess({
          url: url,
          status: response.statusCode,
          content: body
      });
      self.crawlUrls(self.getAllUrls(url, body), depth - 1, onSuccess, onFailure);
    } else if (onFailure) {
      onFailure({
        url: url,
        status: response ? response.statusCode : undefined
      });
    }
  });
};

Crawler.prototype.getAllUrls = function(baseUrl, body) {
  var self = this;
  var linksRegex = self.ignoreRelative ? /<a[^>]+?href=".*?:\/\/.*?"/gm : /<a[^>]+?href=".*?"/gm;
  var links = body.match(linksRegex) || [];

  links = _.map(links, function(link) {
    var match = /href=\"(.*?)[#\"]/.exec(link);

    link = match[1];
    link = link.indexOf("://") >=0 ? link : baseUrl + link;
    return link;
  });
  return _.chain(links)
    .uniq()
    .filter(this.shouldCrawl)
    .value();
};

Crawler.prototype.crawlUrls = function(urls, depth, onSuccess, onFailure) {
  var self = this;

  _.each(urls, function(url) {
    self.crawlUrl(url, depth, onSuccess, onFailure);
  });
};

module.exports = Crawler;