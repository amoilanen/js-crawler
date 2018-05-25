import Crawler from '../crawler';
import AsynchronousExecutor, { ExecutableTask, Executor } from '../src/executor';
import { immediateExecutor, textResponse, interceptAfter } from './util/util';
import DefaultRequest, { Request } from '../src/request';
import State from '../src/state';
const _ = require('underscore');
import * as sinon from 'sinon';
import { expect } from 'chai';
import { HttpResponse } from '../src/response';

describe('crawler', () => {

  const url = 'http://someurl.edu';
  let crawler: Crawler;
  let createExecutor: any;
  let request: Request;
  let createRequest: any;
  let response: HttpResponse;

  const succeedingRequest = (options: {visitedUrls: string[], lastVisitedUrl: string, response: HttpResponse}) => {
    const { visitedUrls, lastVisitedUrl, response } = options;

    return ({
      submit: sinon.stub().callsFake(() => {
        return Promise.resolve({
          visitedUrls: visitedUrls,
          lastVisitedUrl: lastVisitedUrl,
          response
        })
      })
    });
  }

  beforeEach(() => {
    crawler = new Crawler();
    response = textResponse(url, 200, 'body');
    request = succeedingRequest({
      visitedUrls: [ url ],
      lastVisitedUrl: url,
      response
    });
    crawler.createExecutor = sinon.stub().callsFake(() => immediateExecutor);
    createRequest = sinon.stub().callsFake(() => request);
    crawler.createRequest = createRequest;
  });

  describe('crawl 1 url', () => {

    let success;
    let failure;
    let finished;

    beforeEach(() => {
      success = sinon.fake();
      failure = sinon.fake();
      finished = sinon.fake();
    });

    it('should call callbacks and update state when successful', (done) => {
      interceptAfter(crawler.state, 'finishedCrawling', url => {
        sinon.assert.calledWith(createRequest, null, url);
        expect(crawler.state.crawledUrls).to.eql({  [url]: true });
        expect(crawler.state.visitedUrls).to.eql({ [url]: true });
        expect(crawler.state.beingCrawledUrls).to.eql([]);
        sinon.assert.calledWith(success, {
          url,
          status: 200,
          content: 'body',
          error: null,
          response: response,
          body: 'body',
          referer: ''
        });
        expect(failure.notCalled).to.be.true;
        sinon.assert.calledWith(finished, [url]);
        done();
      });

      crawler.crawl({
        url,
        success,
        failure,
        finished
      });
    });

    it('should call callbacks and update state when unsuccessful', (done) => {
      const error = 'Some error';
      const submitReference: any = request.submit;
      submitReference.callsFake(() => {
        return Promise.reject({
          error,
          response
        })
      });
      const errorBody = 'Some error happened';
      response = textResponse(url, 404, errorBody);

      interceptAfter(crawler.state, 'finishedCrawling', url => {
        sinon.assert.calledWith(createRequest, null, url);
        expect(crawler.state.crawledUrls).to.eql({  [url]: true });
        expect(crawler.state.visitedUrls).to.eql({ [url]: true });
        expect(crawler.state.beingCrawledUrls).to.eql([]);
        expect(success.notCalled).to.be.true;
        sinon.assert.calledWith(failure, {
          url,
          status: 404,
          content: errorBody,
          error: error,
          response: response,
          body: errorBody,
          referer: ''
        });
        sinon.assert.calledWith(finished, [url]);
        done();
      });

      crawler.crawl({
        url,
        success,
        failure,
        finished
      });
    });
  });

  //TODO: Urls from the response are crawled again if depth > 1
  //TODO: If depth is 1 urls from the response are not crawled

  //TODO: If url has already been crawled or visited it is not crawled again
  //TODO: If depth is 0 url is not crawled
  //TODO: Crawled url is remembered in the state
  //TODO: Test different RequestSuccess values and how they are handled
  //TODO: Test redirects
  //TODO: On crawling finished callback "finished" is called, executor is stopped
});