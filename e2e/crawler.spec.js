var Crawler = require('../crawler');
var _ = require('underscore');

describe('crawler', function() {

  var crawler;

  beforeEach(function() {
    crawler = new Crawler();
    crawler.configure();
  });

  describe('graph no cycles', function() {

    it('should crawl all the urls', function(done) {
      var crawledUrls = [];
      var expectedUrls = [];

      crawler.crawl("http://localhost:3000/graph_no_cycles/page1.html",
        function onSuccess(page) {
          crawledUrls.push(page.url);
        },
        function onFailure() {
          expect('Errors while crawling').to.be('');
        },
        function onAllFinished(crawledUrls) {
          expect(crawledUrls).toEqual(expectedUrls);
          done();
        }
      );
    });

  });
});