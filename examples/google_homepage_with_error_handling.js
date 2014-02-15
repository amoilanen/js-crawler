var Crawler = require("../crawler.js");

new Crawler().configure({depth: 3})
  .crawl("http://www.google.com", function(page) {
    console.log(page.url);
  }, function(response) {
    console.log("ERROR occurred:");
    console.log(response.status);
    console.log(response.url);
  });