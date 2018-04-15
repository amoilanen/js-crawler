import Response from '../src/response';
const _ = require('underscore');
import * as sinon from 'sinon';
import { expect } from 'chai';

describe('response', () => {

  let response: Response;

  const crawlOptions = {
    ignoreRelative: false,
    shouldCrawl: () => true
  };

  beforeEach(() => {
    response = new Response({
      headers: {
        'content-type': 'text/html'
      },
      body: null,
      statusCode: null,
      request: null
    });
  });

  describe('checking if url protocol is supported', () => {

    it('should not support ftp', () => {
      expect(response.isUrlProtocolSupported('ftp://someftplink')).to.be.false;
    });

    it('should not support mailto', () => {
      expect(response.isUrlProtocolSupported('mailto:someone@somewhere.com')).to.be.false;
    });

    it('should support http', () => {
      expect(response.isUrlProtocolSupported('http://somehttplink')).to.be.true;
    });

    it('should support https', () => {
      expect(response.isUrlProtocolSupported('https://somehttplink')).to.be.true;
    });
  });

  describe('html comments', () => {

    it('should strip when present', () => {
      expect(response.stripComments(
        '<html><!--comment1--><body><!--comment2--></body></html>'
      )).to.eql(
        '<html><body></body></html>'
      );
    });

    it('should make no changes to html with no comments', () => {
      expect(response.stripComments(
        '<div id="someDiv"></div>'
      )).to.eql(
        '<div id="someDiv"></div>'
      );
    });
  });

  describe('getting urls from fragment', () => {

    const baseUrl = 'http://localhost:8080/basePath';

    describe('is not text/html', () => {

      it('should return empty list of urls', () => {
        response = new Response({
          headers: {
            'content-type': 'audio/mpeg'
          },
          body: null,
          statusCode: null,
          request: null
        });
        expect(response.getAllUrls(baseUrl, '<a href="somePath/resource1"></a>', crawlOptions))
          .to.eql([]);
      });
    });

    it('should get a relative url from fragment', () => {
      expect(response.getAllUrls(baseUrl, '<a href="somePath/resource1"></a>', crawlOptions))
        .to.eql(['http://localhost:8080/somePath/resource1']);
    });

    it('should get several urls from fragment', () => {
      const fragment = `
Link a
<a href="a"></a>
Link b
<a href="b"></a>
Link c
<a href="c"></a>
`;

      expect(response.getAllUrls(baseUrl, fragment, crawlOptions))
        .to.eql([
          'http://localhost:8080/a',
          'http://localhost:8080/b',
          'http://localhost:8080/c'
        ]);
    });

    it('should get absolute url from fragment', () => {
      expect(response.getAllUrls(baseUrl, '<a href="http://someotherhost/resource"></a>', crawlOptions))
        .to.eql(['http://someotherhost/resource']);
    });

    it('should ignore mailto links', () => {
      expect(response.getAllUrls(baseUrl, '<a href="mailto:someone@somewhere.com"></a>', crawlOptions))
        .to.eql([]);
    });

    it('should ignore ftp links', () => {
      expect(response.getAllUrls(baseUrl, '<a href="ftp://myserver.org"></a>', crawlOptions))
        .to.eql([]);
    });
    
    it('should work with single or double quoted attribute values', () => {
      expect(response.getAllUrls(baseUrl, '<a href="http://doublequoted.org"></a>'+"<a href='http://singlequoted.org'></a>", crawlOptions))
        .to.eql(['http://doublequoted.org/','http://singlequoted.org/']);
    });

    describe('ignoreRelative option', () => {

      const crawlOptions = {
        ignoreRelative: true,
        shouldCrawl: () => true
      };

      describe('enabled', () => {

        it('should ignore relative urls', () => {
          expect(response.getAllUrls(baseUrl, '<a href="/resource"></a>', crawlOptions)).to.eql([]);
        });

        it('should not ignore absolute urls', () => {
          expect(response.getAllUrls(baseUrl, '<a href="http://localhost/resource"></a>', crawlOptions))
            .to.eql(['http://localhost/resource']);
        });
      });

      describe('disabled', () => {

        const crawlOptions = {
          ignoreRelative: false,
          shouldCrawl: () => true
        };

        it('should not ignore relative urls', () => {
          expect(response.getAllUrls(baseUrl, '<a href="/resource"></a>', crawlOptions))
            .to.eql(['http://localhost:8080/resource']);
        });

        it('should not ignore absolute urls', () => {
          expect(response.getAllUrls(baseUrl, '<a href="http://localhost/resource"></a>', crawlOptions))
            .to.eql(['http://localhost/resource']);
        });
      });
    });

    it('should ignore links in the comments', () => {
      expect(response.getAllUrls(baseUrl, '<!--<a href="http://localhost/resource"></a>-->', crawlOptions))
        .to.eql([]);
    });

    describe('shouldCrawl option', () => {

      it('should filter urls based on shouldCrawl', () => {
        const crawlOptions = {
          shouldCrawl: url => {
            const resourceId = parseInt(url.substring(url.lastIndexOf('/') + 1));

            return resourceId % 2 === 0;
          }
        };

        const fragment = `<a href="/resource/1"></a>
<a href="/resource/2"></a>
<a href="/resource/3"></a>
<a href="/resource/4"></a>
<a href="/resource/5"></a>
`;

        expect(response.getAllUrls(baseUrl, fragment, crawlOptions))
          .to.eql([
            'http://localhost:8080/resource/2',
            'http://localhost:8080/resource/4'
          ]);
      });
    });

    describe('base url specified in HTML', () => {
      const defaultBaseUrl = 'http://localhost:8080/defaultbase/';
      const specifiedAbsoluteBaseUrl = 'http://localhost:8080/specifiedabsolutebase/';
      const specifiedRelativeBaseUrl = 'specifiedrelativebase/';

      it('should resolve relative urls using base url', () => {
        const fragment = `<base href="${specifiedAbsoluteBaseUrl}">\
<a href="resource/1"></a>
<a href="resource/2"></a>
<a href="resource/3"></a>`;

        expect(response.getAllUrls(defaultBaseUrl, fragment, crawlOptions))
          .to.eql([
            'http://localhost:8080/specifiedabsolutebase/resource/1',
            'http://localhost:8080/specifiedabsolutebase/resource/2',
            'http://localhost:8080/specifiedabsolutebase/resource/3'
          ]);
      });

      it('should resolve absolute urls to themselves', () => {
        const fragment = `<base href="${specifiedAbsoluteBaseUrl}">
<a href="/resource/1"></a>`;

        expect(response.getAllUrls(defaultBaseUrl, fragment, crawlOptions))
          .to.eql([
            'http://localhost:8080/resource/1'
          ]);
      });

      it('should resolve relative urls with relative base url specified', () => {
        const fragment = `<base href="${specifiedRelativeBaseUrl}">
<a href="resource/1"></a>`;

        expect(response.getAllUrls(defaultBaseUrl, fragment, crawlOptions))
          .to.eql([
            'http://localhost:8080/defaultbase/specifiedrelativebase/resource/1'
          ]);
      });
    });
  });

  describe('content encoding', () => {

    const decodedBody = 'Decoded body';
    const url = 'someUrl';
    const OK = 200;
    const body = `Some next urls
<a href="url1"></a>
<a href="url2"></a>
<a href="url3"></a>`;
    let httpResponse;

    beforeEach(() => {
      httpResponse = {
        statusCode: OK,
        headers: {
          'content-type': 'text/html'
        },
        request: {
          uri: {
            href: url
          }
        },
        body: {
          toString: () => body
        }
      };
      httpResponse.headers['content-type'] = 'text/html';
      sinon.stub(httpResponse.body, 'toString').returns(decodedBody);
      response = new Response(httpResponse);
    });

    it('if no header provided, utf8 is used by default', () => {
      response.getBody();
      expect(httpResponse.body.toString.calledWith('utf8')).to.be.true;
    });

    it('if header provided, it is used', () => {
      httpResponse.headers['content-encoding'] = 'gzip';
      response.getBody();
      expect(httpResponse.body.toString.calledWith('gzip')).to.be.true;
    });

    it('if content-type is text/html then isTextHtml should return true', () => {
      expect(response.isTextHtml()).to.eql(true);
    })

    it('if response is not defined, content is not considered to be text', () => {
      response = new Response(undefined);
      expect(response.isTextHtml()).to.eql(false);
    });

    it('if invalid encoding is specified, default encoding will be used', () => {
      httpResponse.body.toString.callsFake(encoding => {
        if (encoding !== 'utf8') {
          throw new Error('Unknown encoding ' + encoding);
        }
        return decodedBody;
      });
      httpResponse.headers['content-encoding'] = 'none';
      expect(response.getBody()).to.eql(decodedBody);
    });
  });
});
