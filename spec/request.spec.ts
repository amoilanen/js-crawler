import DefaultRequest, { RequestOptions, HttpClient, RequestSuccess, RequestFailure } from '../src/request';
import { HttpResponse } from '../src/response';
const _ = require('underscore');
import * as sinon from 'sinon';
import { expect } from 'chai';

describe('request', () => {

  const referer = 'referer';
  const url = 'url';
  const redirectDestinationUrl = 'redirectDestinationUrl';
  const userAgent = 'userAgent';

  const requestOptions: RequestOptions = {
    referer,
    url,
    userAgent
  };

  let request: DefaultRequest;
  let mockHttpClient: HttpClient;

  let callbackContext;
  let error: any;
  let response: HttpResponse;

  let receivedRequestOptions;

  type CallbackType = (error, response: HttpResponse) => void;

  beforeEach(() => {
    callbackContext = {
      _redirect: {
        redirects: []
      }
    };
    error = null;
    response = {
      headers: {
      },
      body: {
        toString: (encoding: string) => ''
      },
      statusCode: 200,
      request: {
        uri: {
          href: url
        }
      }
    };
    mockHttpClient = sinon.stub().callsFake((options: any, callback: CallbackType) => {
      callback.call(callbackContext, error, response);
      receivedRequestOptions = options;
    });
    request = new DefaultRequest(requestOptions, mockHttpClient);
  });

  describe('success response', () => {

    it('should provide correct request options', () => {
      const expectedOptions = {
        url: url,
        encoding: null,
        rejectUnauthorized : false,
        followRedirect: true,
        followAllRedirects: true,
        headers: {
          'User-Agent': userAgent,
          'Referer': referer
        }
      };

      return request.submit().then(() => {
        expect(receivedRequestOptions).to.eql(expectedOptions);
      });
    });

    it('submit should resolve to RequestSuccess', () => {
      const expectedRequestSuccess = {
        visitedUrls: [url],
        lastVisitedUrl: url,
        response
      };
      return request.submit().then((requestSuccess: RequestSuccess) => {
        expect(requestSuccess).to.eql(expectedRequestSuccess);
      });
    });

    describe('redirects', () => {

      it('should include redirect urls', () => {
        callbackContext._redirect.redirects = [
          { redirectUri: 'url1' }, { redirectUri: 'url2' }, { redirectUri: 'url3' }
        ];
        response.request.uri.href = redirectDestinationUrl;
        const expectedRequestSuccess = {
          visitedUrls: ['url1', 'url2', 'url3', url, redirectDestinationUrl],
          lastVisitedUrl: url,
          response
        };
        return request.submit().then((requestSuccess: RequestSuccess) => {
          expect(requestSuccess.visitedUrls).to.eql(expectedRequestSuccess.visitedUrls);
        });
      });
    });
  });

  describe('request failure', () => {

    beforeEach(() => {
      error = "Error that happened during request";
      response.statusCode = 404;
    });

    it('should reject with RequestFailure', () => {
      const expectedRequestFailure = {
        error,
        response
      };
      return request.submit().catch((requestFailure: RequestFailure) => {
        expect(requestFailure).to.eql(expectedRequestFailure);
      });
    });
  });
});
