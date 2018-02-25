var Crawler = require("../compiled/crawler.js");

new Crawler().configure({depth: 3})
  .crawl("http://www.google.com", function onSuccess(page) {
    console.log(page.url);
  });