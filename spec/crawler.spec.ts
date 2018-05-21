import Crawler from '../crawler';
import AsynchronousExecutor, { ExecutableTask, Executor } from '../src/executor';
import DefaultRequest, { Request } from '../src/request';
import State from '../src/state';
const _ = require('underscore');
import * as sinon from 'sinon';
import { expect } from 'chai';
import { HttpResponse } from '../src/response';

describe('crawler', () => {

  const url = 'http://someurl.edu';
  let crawler: Crawler;
  let executor: Executor;
  let createExecutor: any;
  let request: Request;
  let createRequest: any;
  let response: HttpResponse;

  beforeEach(() => {
    crawler = new Crawler();
    executor = {
      start: () => {},
      submit: (task: ExecutableTask) => {
        task();
      },
      stop: () => {}
    };
    response = {
      headers: {
        'content-type': 'text/html'
      },
      body: {
        toString(encoding: string) {
          return 'body';
        }
      },
      statusCode: 200,
      request: {
        uri: {
          href: url
        }
      }
    };
    request = {
      submit: sinon.stub().callsFake(() => {
        return Promise.resolve({
          visitedUrls: [ url ],
          lastVisitedUrl: url,
          response
        })
      })
    };

    createExecutor = sinon.stub().callsFake(() => executor);
    crawler.createExecutor = createExecutor;
    createRequest = sinon.stub().callsFake(() => request);
    crawler.createRequest = createRequest;
  });

  describe('crawl 1 url', () => {

    const success = sinon.fake();
    const failure = sinon.fake();
    const finished = sinon.fake();

    it('should call request', (done) => {
      const originalFinishedCrawling = crawler.state.finishedCrawling;
      const fakeFinishedCrawling = sinon.stub();
      crawler.state.finishedCrawling = fakeFinishedCrawling;
      fakeFinishedCrawling.callsFake(() => {
        originalFinishedCrawling.call(crawler.state, url);
        expect(createRequest.calledWith(null, url)).to.be.true;
        expect(crawler.state.crawledUrls).to.eql({  [url]: true });
        expect(crawler.state.visitedUrls).to.eql({ [url]: true });
        expect(crawler.state.beingCrawledUrls).to.eql([]);
        expect(success.calledWith({
          url,
          status: 200,
          content: 'body',
          error: null,
          response: response,
          body: 'body',
          referer: ''
        })).to.be.true;
        expect(failure.notCalled).to.be.true;
        expect(finished.calledWith([url])).to.be.true;
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

  //TODO: If url has already been crawled or visited it is not crawled again
  //TODO: If depth is 0 url is not crawled
  //TODO: Crawled url is remembered in the state
  //TODO: Urls from the response are crawled again if depth > 1
  //TODO: If depth is 1 urls from the response are not crawled
  //TODO: Test different RequestSuccess values and how they are handled
  //TODO: On crawling finished callback "finished" is called, executor is stopped
});