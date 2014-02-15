var Crawler = require("../crawler.js");

new Crawler().crawl("https://github.com/ariya/phantomjs/wiki/Quick-Start", 2,
  function onSuccess(page) {
    console.log("Loaded page. URL = " + page.url + " content length = " + page.content.length + " status = " + page.status);
  },
  function onFailure(page) {
    console.log("Could not load page. URL = " +  page.url + " status = " + page.status);
  }
);