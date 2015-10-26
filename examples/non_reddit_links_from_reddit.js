/*
 * Demonstrates how we can filter out which urls should be crawled.
 */
var Crawler = require("../crawler.js");

var topLevelUrl = "https://www.reddit.com/";

var crawler = new Crawler().configure({
  shouldCrawl: function(url) {
    return (url.indexOf("reddit.com") < 0) || (topLevelUrl === url);
  }
});

crawler.crawl(topLevelUrl, function(page) {
  console.log(page.url);
});