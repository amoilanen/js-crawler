var Crawler = require("../crawler.js");

//Also possible to configure maximum 1 request per 10 seconds
//var crawler = new Crawler().configure({maxRequestsPerSecond: 0.1});
var crawler = new Crawler().configure({maxRequestsPerSecond: 2});

crawler.crawl({
  url: "https://github.com",
  success: function(page) {
    console.log(page.url);
  },
  failure: function(page) {
    console.log(page.status);
  }
});