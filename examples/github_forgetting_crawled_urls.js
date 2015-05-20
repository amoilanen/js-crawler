var Crawler = require("../crawler.js");

var crawler = new Crawler().configure({ignoreRelative: false, depth: 2});

crawler.crawl("https://github.com",
  function onSuccess(page) {
    console.log("Loaded page. URL = " + page.url + " content length = " + page.content.length + " status = " + page.status);
  },
  function onFailure(page) {
    console.log("Could not load page. URL = " +  page.url + " status = " + page.status);
  },
  function onAllFinished() {
    console.log('Forgetting all crawled...');
    crawler.forgetCrawled();
    crawler.crawl("https://github.com",
      function onSuccess(page) {
        console.log("Loaded page. URL = " + page.url + " content length = " + page.content.length + " status = " + page.status);
      },
      function onFailure(page) {
        console.log("Could not load page. URL = " +  page.url + " status = " + page.status);
      }
    );
  }
);