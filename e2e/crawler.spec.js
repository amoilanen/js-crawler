var Crawler = require('../crawler');
var _ = require('underscore');

describe('crawler', function() {

  var crawler;

  beforeEach(function() {
    crawler = new Crawler();
    crawler.configure({depth: 10});
  });

  describe('graph no cycles', function() {

    it('should crawl all the urls', function(done) {
      var crawledUrls = [];
      var expectedUrls = [
        'http://localhost:3000/graph_no_cycles/page1.html',
        'http://localhost:3000/graph_no_cycles/page2.html',
        'http://localhost:3000/graph_no_cycles/page3.html',
        'http://localhost:3000/graph_no_cycles/sublevel/page4.html',
        'http://localhost:3000/graph_no_cycles/sublevel/sublevel2/page5.html'
      ];

      crawler.crawl('http://localhost:3000/graph_no_cycles/page1.html',
        function onSuccess(page) {
          crawledUrls.push(page.url);
        },
        function onFailure() {
          expect('Errors while crawling').to.be('');
        },
        function onAllFinished(crawledUrls) {
          expect(crawledUrls.sort()).toEqual(expectedUrls.sort());
          done();
        }
      );
    });
  });

  describe('redirects', () => {

    it('should crawl all urls in redirect chain and do not crawl them again', (done) => {
      var crawledUrls = [];
      var expectedUrls = [
        'http://localhost:3000/redirectend'
      ];
      var expectedKnownUrls = [
        'http://localhost:3000/redirect1',
        'http://localhost:3000/redirect2',
        'http://localhost:3000/redirect3',
        'http://localhost:3000/redirectend'
      ];

      crawler.crawl('http://localhost:3000/redirect1',
        function onSuccess(page) {
          crawledUrls.push(page.url);
        },
        function onFailure() {
          expect('Errors while crawling').to.be('');
        },
        function onAllFinished(crawledUrls) {
          expect(crawledUrls.sort()).toEqual(expectedUrls.sort());
          expect(Object.keys(crawler.knownUrls).sort()).toEqual(expectedKnownUrls.sort());
          done();
        }
      );
    });
  });

  //TODO: Redirect with another HTTP code? 301?
  //TODO: Cycles
  //TODO: Binary content
  //TODO: Test for throughput limitation
  //TODO: Test for depth limitation
  //TODO: Test for crawling 1000 links (generate them in server.js)
});