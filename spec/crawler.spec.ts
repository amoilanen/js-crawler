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

  const url = 'http://someurl.edu/';
  let crawler: Crawler;
  let createExecutor: any;
  let requests: Request[];
  let createRequest: any;
  let response: HttpResponse;
  let success;
  let failure;
  let finished;

  const succeedingRequest = (options: {visitedUrls: string[], lastVisitedUrl: string, response: HttpResponse}): Request => {
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
    crawler.createExecutor = sinon.stub().callsFake(() => immediateExecutor);
    createRequest = sinon.stub().callsFake((referer: string, url: string) =>
      succeedingRequest({
        visitedUrls: [ url ],
        lastVisitedUrl: url,
        response
      })
    );
    crawler.createRequest = createRequest;
    success = sinon.fake();
    failure = sinon.fake();
    finished = sinon.stub();
  });

  describe('crawl 1 url', () => {

    it('should call callbacks and update state when successful', done => {
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
      const errorBody = 'Some error happened';
      response = textResponse(url, 404, errorBody);
      createRequest = sinon.stub().callsFake((referer: string, url: string) =>
        ({
          submit: sinon.stub().callsFake(() => Promise.reject({
            error,
            response
          }))
        })
      );
      crawler.createRequest = createRequest;

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

  describe('crawled url contains links to further urls', () => {

    const responseBody = `
      <a href="a"></a>
      <a href="b"></a>
      <a href="c"></a>`;

    beforeEach(() => {
      response.body = {
        toString: () => responseBody
      };
    });

    describe('depth is greater than 1', () => {

      it('should crawl links', done => {
        const expectedUrls = [
          url,
          `${url}a`,
          `${url}b`,
          `${url}c`
        ];

        finished.callsFake(urls => {
          expect(urls).to.eql(expectedUrls);
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

    describe('depth is 1', () => {

      it('should crawl only parent url', done => {
        const expectedUrls = [ url ];

        finished.callsFake(urls => {
          expect(urls).to.eql(expectedUrls);
          done();
        });

        crawler.configure({
          depth: 1,
          success,
          failure,
          finished
        });

        crawler.crawl({
          url,
          success,
          failure,
          finished
        });
      });
    });

    describe('depth is 0', () => {

      it('should not crawl any urls, should call "finished" callback still', done => {
        finished.callsFake(urls => {
          expect(urls).to.eql([]);
          done();
        });

        crawler.configure({
          depth: 0,
          success,
          failure,
          finished
        });

        crawler.crawl({
          url,
          success,
          failure,
          finished
        });
      });
    });
  });

  describe('remembering crawled urls', () => {

    const responseBody = `<a href="${url}"></a>`;

    beforeEach(() => {
      response.body = {
        toString: () => responseBody
      };
      crawler.configure({
        depth: 2,
        success,
        failure,
        finished
      });

      crawler.crawl({
        url,
        success,
        failure,
        finished
      });
    });

    it('should not crawl urls twice', done => {
      finished.callsFake(urls => {
        expect(urls).to.eql([url]);
        expect(success.calledOnce).to.be.true;
        sinon.assert.calledWith(success, {
          url,
          status: 200,
          content: responseBody,
          error: null,
          response: response,
          body: responseBody,
          referer: ''
        });
        expect(failure.notCalled).to.be.true;
        done();
      });
    });

    it('should remember crawled url in the state', done => {
      finished.callsFake(urls => {
        expect(crawler.state.visitedUrls).to.eql({
          [url]: true
        });
        expect(crawler.state.crawledUrls).to.eql({
          [url]: true
        });
        done();
      });
    });
  });

  //TODO: Test that urls are normalized when they are remembered

  //TODO: Test different RequestSuccess values and how they are handled
  //TODO: Test redirects
  //TODO: On crawling finished callback "finished" is called, executor is stopped
});