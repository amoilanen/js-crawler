var Crawler = require("../crawler.js");

new Crawler().configure({depth: 2}).crawl("http://www.yahoo.com",
  function onSuccess(page) {
    console.log('SUCCESS', page.url);
  },
  function onFailure(status) {
    console.log('ERROR', status.url, status.error);
  }
);