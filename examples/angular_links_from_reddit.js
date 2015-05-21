/*
 * Demonstrates how crawler results can be filtered.
 */
var Crawler = require("../crawler.js");

new Crawler().configure({depth: 2}).crawl("http://www.reddit.com/r/javascript/", function onSuccess(page) {
  if (page.url.indexOf("angular") >= 0) {
    console.log(page.url);
  }
});