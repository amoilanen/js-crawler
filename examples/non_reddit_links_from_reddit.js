/*
 * Demonstrates how we can filter out which urls should be crawled.
 */
var Crawler = require("../crawler.js");

var crawler = new Crawler().configure({
  shouldCrawl: function(url) {
    return url.indexOf("reddit.com") < 0;
  }
});

crawler.crawl("http://www.reddit.com/r/javascript", function(page) {
  console.log(page.url);
});