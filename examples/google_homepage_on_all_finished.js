var Crawler = require("../crawler.js");

new Crawler().configure({depth: 2})
  .crawl("http://www.google.com", function onSuccess(page) {
    console.log(page.url);
  }, null, function onAllFinished(crawledUrls) {
    console.log('All crawling finished');
    console.log(crawledUrls);
  });