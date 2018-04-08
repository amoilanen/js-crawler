import Response from '../src/response';
var _ = require('underscore');

function getRecordedCallArguments(spyObj, methodName) {
  return spyObj[methodName].calls.all().map(function(call) {
    return call.args;
  });
}

describe('response', function() {

  var response;

  var crawlOptions = {
    ignoreRelative: false,
    shouldCrawl: () => true
  };

  beforeEach(function() {
    response = new Response(null);
  });

  describe('html comments', function() {

    it('should strip when present', function() {
      expect(response.stripComments(
        '<html><!--comment1--><body><!--comment2--></body></html>'
      )).toBe(
        '<html><body></body></html>'
      );
    });

    it('should make no changes to html with no comments', function() {
      expect(response.stripComments(
        '<div id="someDiv"></div>'
      )).toBe(
        '<div id="someDiv"></div>'
      );
    });
  });

  describe('getting urls from fragment', function() {

    var baseUrl = 'http://localhost:8080/basePath';

    it('should get a relative url from fragment', function() {
      expect(response.getAllUrls(baseUrl, '<a href="somePath/resource1"></a>', crawlOptions))
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

      expect(response.getAllUrls(baseUrl, fragment, crawlOptions))
        .toEqual([
          'http://localhost:8080/a',
          'http://localhost:8080/b',
          'http://localhost:8080/c'
        ]);
    });

    it('should get absolute url from fragment', function() {
      expect(response.getAllUrls(baseUrl, '<a href="http://someotherhost/resource"></a>', crawlOptions))
        .toEqual(['http://someotherhost/resource']);
    });

    it('should ignore mailto links', function() {
      expect(response.getAllUrls(baseUrl, '<a href="mailto:someone@somewhere.com"></a>', crawlOptions))
        .toEqual([]);
    });

    it('should ignore ftp links', function() {
      expect(response.getAllUrls(baseUrl, '<a href="ftp://myserver.org"></a>', crawlOptions))
        .toEqual([]);
    });
    
    it('should work with single or double quoted attribute values', function() {
      expect(response.getAllUrls(baseUrl, '<a href="http://doublequoted.org"></a>'+"<a href='http://singlequoted.org'></a>", crawlOptions))
        .toEqual(['http://doublequoted.org/','http://singlequoted.org/']);
    });

    describe('ignoreRelative option', function() {

      var crawlOptions = {
        ignoreRelative: true,
        shouldCrawl: () => true
      };

      describe('enabled', function() {

        it('should ignore relative urls', function() {
          expect(response.getAllUrls(baseUrl, '<a href="/resource"></a>', crawlOptions)).toEqual([]);
        });

        it('should not ignore absolute urls', function() {
          expect(response.getAllUrls(baseUrl, '<a href="http://localhost/resource"></a>', crawlOptions))
            .toEqual(['http://localhost/resource']);
        });
      });

      describe('disabled', function() {

        var crawlOptions = {
          ignoreRelative: false,
          shouldCrawl: () => true
        };

        it('should not ignore relative urls', function() {
          expect(response.getAllUrls(baseUrl, '<a href="/resource"></a>', crawlOptions))
            .toEqual(['http://localhost:8080/resource']);
        });

        it('should not ignore absolute urls', function() {
          expect(response.getAllUrls(baseUrl, '<a href="http://localhost/resource"></a>', crawlOptions))
            .toEqual(['http://localhost/resource']);
        });
      });
    });

    it('should ignore links in the comments', function() {
      expect(response.getAllUrls(baseUrl, '<!--<a href="http://localhost/resource"></a>-->', crawlOptions))
        .toEqual([]);
    });

    describe('shouldCrawl option', function() {

      it('should filter urls based on shouldCrawl', function() {
        var crawlOptions = {
          shouldCrawl: function isOddResource(url) {
            var resourceId = parseInt(url.substring(url.lastIndexOf('/') + 1));

            return resourceId % 2 === 0;
          }
        };

        var fragment = '<a href="/resource/1"></a>\
<a href="/resource/2"></a>\
<a href="/resource/3"></a>\
<a href="/resource/4"></a>\
<a href="/resource/5"></a>\
';

        expect(response.getAllUrls(baseUrl, fragment, crawlOptions))
          .toEqual([
            'http://localhost:8080/resource/2',
            'http://localhost:8080/resource/4'
          ]);
      });
    });

    describe('base url specified in HTML', function() {

      var defaultBaseUrl = 'http://localhost:8080/defaultbase/';
      var specifiedAbsoluteBaseUrl = 'http://localhost:8080/specifiedabsolutebase/';
      var specifiedRelativeBaseUrl = 'specifiedrelativebase/';

      it('should resolve relative urls using base url', function() {
        var fragment = '<base href="' +specifiedAbsoluteBaseUrl + '">\
<a href="resource/1"></a>\
<a href="resource/2"></a>\
<a href="resource/3"></a>';

        expect(response.getAllUrls(defaultBaseUrl, fragment, crawlOptions))
          .toEqual([
            'http://localhost:8080/specifiedabsolutebase/resource/1',
            'http://localhost:8080/specifiedabsolutebase/resource/2',
            'http://localhost:8080/specifiedabsolutebase/resource/3'
          ]);
      });

      it('should resolve absolute urls to themselves', function() {
        var fragment = '<base href="' +specifiedAbsoluteBaseUrl + '">\
<a href="/resource/1"></a>';

        expect(response.getAllUrls(defaultBaseUrl, fragment, crawlOptions))
          .toEqual([
            'http://localhost:8080/resource/1'
          ]);
      });

      it('should resolve relative urls with relative base url specified', function() {
        var fragment = '<base href="' +specifiedRelativeBaseUrl + '">\
<a href="resource/1"></a>';

        expect(response.getAllUrls(defaultBaseUrl, fragment, crawlOptions))
          .toEqual([
            'http://localhost:8080/defaultbase/specifiedrelativebase/resource/1'
          ]);
      });
    });
  });

  describe('content encoding', function () {

    var decodedBody = 'Decoded body';
    var url = 'someUrl';
    var OK = 200;
    var body: any = 'Some next urls\
<a href="url1"></a>\
<a href="url2"></a>\
<a href="url3"></a>';
    var httpResponse = {
      statusCode: OK,
      headers: {
        'content-type': 'text/html'
      },
      request: {
        uri: {
          href: url
        }
      },
      body: body
    };

    beforeEach(function () {
      httpResponse.headers['content-type'] = 'text/html';
      httpResponse.body = jasmine.createSpyObj('bodyBuffer', ['toString']);
      httpResponse.body.toString.and.returnValue(decodedBody);
      response = new Response(httpResponse);
    });

    it('if no header provided, utf8 is used by default', function () {
      response.getBody();
      expect(httpResponse.body.toString).toHaveBeenCalledWith('utf8');
    });

    it('if header provided, it is used', function () {
      httpResponse.headers['content-encoding'] = 'gzip';
      response.getBody();
      expect(httpResponse.body.toString).toHaveBeenCalledWith('gzip');
    });

    it('if content-type is text/html then isTextHtml should return true', () => {
      expect(response.isTextHtml()).toBe(true);
    })

    it('if response is not defined, content is not considered to be text', function () {
      response = new Response(undefined);
      expect(response.isTextHtml()).toBe(false);
    });

    it('if invalid encoding is specified, default encoding will be used', function () {
      httpResponse.body.toString.and.callFake(function (encoding) {
        if (encoding !== 'utf8') {
          throw new Error('Unknown encoding ' + encoding);
        }
        return decodedBody;
      });
      httpResponse.headers['content-encoding'] = 'none';
      expect(response.getBody()).toEqual(decodedBody);
    });
  });
});
