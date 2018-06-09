/*
 * Demonstrates how we can filter out which urls should be crawled.
 */
var Crawler = require("js-crawler").default;

var topLevelUrl = "https://www.reddit.com/";

var crawler = new Crawler().configure({
  shouldCrawl: function(url) {
    return (url.indexOf("reddit.com") < 0) || (topLevelUrl === url);
  }
});

crawler.crawl(topLevelUrl, function(page) {
  console.log(page.url);
});