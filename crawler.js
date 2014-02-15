var request = require("request");
var _ = require("underscore");

function Crawler() {
  this.visitedURLs = {};
}

Crawler.prototype.crawl = function (url, depth, onSuccess, onFailure) {
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
      self.crawlURLs(self.getAllURLs(url, body), depth - 1, onSuccess, onFailure);
    } else if (onFailure) {
      onFailure({
        url: url,
        status: response.statusCode
      });
    }
  });
};

Crawler.prototype.getAllURLs = function(baseUrl, body) {
  var links = body.match(/<a[^>]+?href="(.*?)"/gm) || [];

  links = _.map(links, function(link) {
    var match = /href=\"(.*?)\"/.exec(link);

    link = match[1];
    link = link.indexOf("://") >=0 ? link : baseUrl + link;
    return link;
  });
  return _.uniq(links);
};

Crawler.prototype.crawlURLs = function(urls, depth, onSuccess, onFailure) {
  var self = this;

  _.each(urls, function(url) {
    self.crawl(url, depth, onSuccess, onFailure);
  });
};

module.exports = Crawler;