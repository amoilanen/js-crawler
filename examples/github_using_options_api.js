var Crawler = require("../crawler.js");

var crawler = new Crawler().configure({ignoreRelative: false, depth: 2});

crawler.crawl({
  url: "https://github.com",
  success: function(page) {
    console.log("Loaded page. URL = " + page.url + " content length = " + page.content.length + " status = " + page.status);
  },
  failure: function(page) {
    console.log("Could not load page. URL = " +  page.url + " error = " + page.error);
  },
  finished: function(crawledUrls) {
    console.log('All crawled = ', crawledUrls);
  }
});