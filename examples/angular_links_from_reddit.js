/*
 * Demonstrates how crawler results can be filtered.
 */
var Crawler = require("js-crawler").default;

console.log(Crawler);

new Crawler().configure({depth: 2}).crawl("https://www.reddit.com/r/javascript/", function onSuccess(page) {
  if (page.url.indexOf("angular") >= 0) {
    console.log(page.url);
  }
});