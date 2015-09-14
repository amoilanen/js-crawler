var Crawler = require("../crawler.js");

var urlsCrawledCount = 0;

new Crawler().configure({depth: 2})
  .crawl("http://www.google.com", function onSuccess(page) {
    console.log(page.url);
    urlsCrawledCount++;
  }, null, function onAllFinished(crawledUrls) {
    console.log('All crawling finished');
    console.log(crawledUrls);
    console.log('Urls crawled = ', urlsCrawledCount);
    console.log('On finished all crawling urls in the callback count = ', crawledUrls.length);
  });