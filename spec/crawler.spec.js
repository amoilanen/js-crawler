var Crawler = require('../crawler');

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

    //should get absolute url from fragment
    //ignoreRelative
    //Links in the comments are omitted
    //shouldCrawl
  });
});