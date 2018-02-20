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

  describe('shortened urls', () => {

    function testShortenedUrl(shortenedUrl) {
      it('should crawl all the real urls', function(done) {
        var crawledUrls = [];
        var expectedUrls = [
          'http://localhost:3000/graph_no_cycles/page1.html',
          'http://localhost:3000/graph_no_cycles/page2.html',
          'http://localhost:3000/graph_no_cycles/page3.html',
          'http://localhost:3000/graph_no_cycles/sublevel/page4.html',
          'http://localhost:3000/graph_no_cycles/sublevel/sublevel2/page5.html'
        ];

        crawler.crawl(shortenedUrl,
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
    }

    describe('redirect with status 302', () => {
      testShortenedUrl('http://localhost:3000/shortened');
    });

    describe('bit.ly redirect with status 301', () => {
      testShortenedUrl('http://localhost:3000/bitly-shortened');
    });

    describe('goo.gl redirect with status 307', () => {
      testShortenedUrl('http://localhost:3000/google-shortened');
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

  describe('simple cycle', () => {

    it('should crawl all urls in a cycle only once', (done) => {
      var crawledUrls = [];
      var expectedUrls = [
        'http://localhost:3000/simple_cycle/page1.html',
        'http://localhost:3000/simple_cycle/page2.html',
        'http://localhost:3000/simple_cycle/page3.html'
      ];

      crawler.crawl('http://localhost:3000/simple_cycle/page1.html',
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

  describe('page success', () => {

    it('should return url, content, status', (done) => {
      crawler.crawl('http://localhost:3000/one_page_graph/page1.html',
        function onSuccess(page) {
          expect(page.url).toEqual('http://localhost:3000/one_page_graph/page1.html');
          expect(page.status).toEqual(200);
          expect(page.content).toEqual('<html><body>One page graph.</body></html>');
          expect(page.error).toBeNull();
          expect(page.response).not.toBeNull();
          expect(page.body).toEqual(page.content);
          done();
        }
      );
    });
  });

  describe('page error', () => {

    it('should return error', (done) => {
      var HTTP_NOT_FOUND = 404;

      crawler.crawl('http://localhost:3000/one_page_graph/no_such_page.html', null,
        function onError(page) {
          expect(page.url).toEqual('http://localhost:3000/one_page_graph/no_such_page.html');
          expect(page.status).toEqual(HTTP_NOT_FOUND);
          expect(page.content).toContain('Cannot GET /one_page_graph/no_such_page.html');
          expect(page.error).toBeNull();
          expect(page.response).not.toBeNull();
          expect(page.body).toEqual(page.content);
          done();
        }
      );
    });
  });

  describe('base tag', () => {

    it('should use base url as the base for relative urls', (done) => {
      var crawledUrls = [];
      var expectedUrls = [
        'http://localhost:3000/base_tag/index/page1.html',
        'http://localhost:3000/base_tag/page2.html'
      ];

      crawler.crawl({
        url: 'http://localhost:3000/base_tag/index/page1.html',
        success: function(page) {
          crawledUrls.push(page.url);
        },
        finished: function(crawledUrls) {
          expect(crawledUrls.sort()).toEqual(expectedUrls.sort());
          done();
        }
      });
    });

    it('should resolve relative base url', (done) => {
      var crawledUrls = [];
      var expectedUrls = [
        'http://localhost:3000/base_tag/index/page1relativebase.html',
        'http://localhost:3000/base_tag/index/relative_base_tag/page3.html'
      ];

      crawler.crawl({
        url: 'http://localhost:3000/base_tag/index/page1relativebase.html',
        success: function(page) {
          crawledUrls.push(page.url);
        },
        finished: function(crawledUrls) {
          expect(crawledUrls.sort()).toEqual(expectedUrls.sort());
          done();
        }
      });
    });
  });

  describe('references contain links to non-http resources', () => {

    it('should ignore mailto link', (done) => {
      var crawledUrls = [];
      var expectedUrls = [
        'http://localhost:3000/non_http_https_links/page1.html',
        'http://localhost:3000/non_http_https_links/page2.html'
      ];

      crawler.crawl({
        url: 'http://localhost:3000/non_http_https_links/page1.html',
        success: function(page) {
          crawledUrls.push(page.url);
        },
        failure: function(error) {
          console.log(error);
          expect('Error while crawling').toEqual('');
          done();
        },
        finished: function(crawledUrls) {
          expect(crawledUrls.sort()).toEqual(expectedUrls.sort());
          done();
        }
      });
    });
  });

  describe('shouldCrawl', () => {

    it('should call onAllFinished when last url should not be crawled', (done) => {
      var expectedUrls = [
        'http://localhost:3000/simple_cycle/page1.html',
        'http://localhost:3000/simple_cycle/page2.html'
      ];

      crawler.configure({
        shouldCrawl: function(url) {
          //Omit page3.html
          return url.indexOf('page3.html') < 0;
        }
      })
      crawler.crawl('http://localhost:3000/simple_cycle/page1.html',
        function onSuccess(page) {
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

    it('should call onAllFinished when no urls should be crawled', (done) => {
      crawler.configure({
        shouldCrawl: function(url) {
          return false;
        }
      })
      crawler.crawl('http://localhost:3000/simple_cycle/page1.html',
        function onSuccess(page) {
        },
        function onFailure() {
          expect('Errors while crawling').to.be('');
        },
        function onAllFinished(crawledUrls) {
          expect(crawledUrls.length).toEqual(0);
          done();
        }
      );
    });
  });

  //TODO: Test for the correct referer value in a chain of visited pages
  //TODO: Test for the shouldCrawlLinksFrom function
  //TODO: Test for shouldCrawl

  //TODO: Redirect with another HTTP code? 301?
  //TODO: Binary content, links are not analyzed in binary content, binary content itself is not returned (as it can be too large)(?)
  //TODO: Test for throughput limitation
  //TODO: Test for depth limitation
  //TODO: Forgetting crawled urls
  //TODO: Reusing the same crawler, no new urls will be crawled
  //TODO: Test for crawling 1000 links (generate them in server.js)
});