/*
 * Demonstrates how the same crawler can be reused among several pages 
 * in order not to visit the same link twice
 */
var Crawler = require("../crawler.js");

var crawler = new Crawler().configure({depth: 2});

function showLink(page) {
  console.log(page.url);
}

crawler.crawl("http://www.reddit.com/r/javascript", showLink);
crawler.crawl("http://www.reddit.com/r/typescript", showLink);