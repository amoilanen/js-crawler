/*
 * Demonstrates how crawler results can be filtered.
 */
var Crawler = require("../crawler.js");

new Crawler().crawl("http://www.reddit.com/r/javascript/", function onSuccess(page) {
  if (page.url.indexOf("jquery") >= 0) {
    console.log(page.url);
  }
});