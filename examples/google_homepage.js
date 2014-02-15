var Crawler = require("../crawler.js");

new Crawler().crawl("http://www.google.com", 3, function onSuccess(page) {
  console.log(page.url);
});