var Crawler = require('../crawler');


function getRecordedCallArguments(spyObj, methodName) {
  return spyObj[methodName].calls.all().map(function(call) {
    return call.args;
  });
}

describe('crawler', function() {

  var crawler;

  beforeEach(function() {
    crawler = new Crawler();
  });

  describe('html comments', function() {

    it('should strip when present', function() {
      expect(crawler._stripComments(
        '<html><!--comment1--><body><!--comment2--></body></html>'
      )).toBe(
        '<html><body></body></html>'
      );
    });

    it('should make no changes to html with no comments', function() {
      expect(crawler._stripComments(
        '<div id="someDiv"></div>'
      )).toBe(
        '<div id="someDiv"></div>'
      );
    });
  });

  describe('getting urls from fragment', function() {

    var baseUrl = 'http://localhost:8080/basePath';

    it('should get a relative url from fragment', function() {
      expect(crawler._getAllUrls(baseUrl, '<a href="somePath/resource1"></a>'))
        .toEqual(['http://localhost:8080/somePath/resource1']);
    });

    it('should get several urls from fragment', function() {
      var fragment = '\
Link a\
<a href="a"></a>\
Link b\
<a href="b"></a>\
Link c\
<a href="c"></a>\
';

      expect(crawler._getAllUrls(baseUrl, fragment))
        .toEqual([
          'http://localhost:8080/a',
          'http://localhost:8080/b',
          'http://localhost:8080/c'
        ]);
    });

    it('should get absolute url from fragment', function() {
      expect(crawler._getAllUrls(baseUrl, '<a href="http://someotherhost/resource"></a>'))
        .toEqual(['http://someotherhost/resource']);
    });

    describe('ignoreRelative option', function() {

      describe('enabled', function() {

        beforeEach(function() {
          crawler.configure({
            ignoreRelative: true
          });
        });

        it('should ignore relative urls', function() {
          expect(crawler._getAllUrls(baseUrl, '<a href="/resource"></a>'))
            .toEqual([]);
        });

        it('should not ignore absolute urls', function() {
          expect(crawler._getAllUrls(baseUrl, '<a href="http://localhost/resource"></a>'))
            .toEqual(['http://localhost/resource']);
        });
      });

      describe('disabled', function() {

        beforeEach(function() {
          crawler.configure({
            ignoreRelative: false
          });
        });

        it('should not ignore relative urls', function() {
          expect(crawler._getAllUrls(baseUrl, '<a href="/resource"></a>'))
            .toEqual(['http://localhost:8080/resource']);
        });

        it('should not ignore absolute urls', function() {
          expect(crawler._getAllUrls(baseUrl, '<a href="http://localhost/resource"></a>'))
            .toEqual(['http://localhost/resource']);
        });
      });
    });

    it('should ignore links in the comments', function() {
      expect(crawler._getAllUrls(baseUrl, '<!--<a href="http://localhost/resource"></a>-->'))
        .toEqual([]);
    });

    describe('shouldCrawl option', function() {

      it('should filter urls based on shouldCrawl', function() {
        crawler.configure({
          shouldCrawl: function isOddResource(url) {
            var resourceId = parseInt(url.substring(url.lastIndexOf('/') + 1));

            return resourceId % 2 === 0;
          }
        });

        var fragment = '<a href="/resource/1"></a>\
<a href="/resource/2"></a>\
<a href="/resource/3"></a>\
<a href="/resource/4"></a>\
<a href="/resource/5"></a>\
';

        expect(crawler._getAllUrls(baseUrl, fragment))
          .toEqual([
            'http://localhost:8080/resource/2',
            'http://localhost:8080/resource/4'
          ]);
      });

      it('should crawl everything if shouldCrawl is not a function', function() {
        crawler.configure({
          shouldCrawl: false
        });

        var fragment = '<a href="/resource/1"></a>';

        expect(crawler._getAllUrls(baseUrl, fragment))
          .toEqual(['http://localhost:8080/resource/1']);
      });
    });
  });

  describe('crawl all urls', function() {

    var referer = 'referer';
    var depth = 1;

    it('should crawl all provided urls', function() {
      spyOn(crawler, '_crawlUrl');
      var urls = ['url1', 'url2', 'url3'];

      crawler._crawlUrls(urls, referer, depth);

      expect(getRecordedCallArguments(crawler, '_crawlUrl')).toEqual([
        ['url1', referer, depth],
        ['url2', referer, depth],
        ['url3', referer, depth]
      ]);
    });
  });
});