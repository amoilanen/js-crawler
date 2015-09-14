var Crawler = require("../crawler.js");

var crawledUrls = {};

//Crawling only urls from the Yahoo site, max 5 per second
new Crawler().configure({
  depth: 2,
  maxConcurrentRequests: 5,
  maxRequestsPerSecond: 5,
  shouldCrawl: function(url) {
    var onMainYahooSite = !!url.match(/^https?:\/\/[^\/]*yahoo.com/);

    if (!onMainYahooSite) {
      console.log('Skipping url, not on the main Yahoo site', url);
    }
    return onMainYahooSite;
  }
}).crawl("http://www.yahoo.com",
  function onSuccess(page) {
    if (crawledUrls[page.url]) {
      console.log('WARNING: url was already crawled before', page.url);
    }
    crawledUrls[page.url] = true;
    console.log('SUCCESS', page.url);
  },
  function onFailure(status) {
    console.log('ERROR', status.url, status.error);
  }
);