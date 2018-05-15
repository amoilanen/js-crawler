import Crawler from '../crawler';
import AsynchronousExecutor, { ExecutableTask, Executor } from '../src/executor';
import DefaultRequest, { Request } from '../src/request';
const _ = require('underscore');
import * as sinon from 'sinon';
import { expect } from 'chai';

describe('crawler', () => {

  const url = 'url';
  let crawler: Crawler;
  let executor: Executor;
  let createExecutor: any;
  let request: Request;
  let createRequest: any;

  beforeEach(() => {
    crawler = new Crawler();
    executor = {
      start: () => {},
      submit: (task: ExecutableTask) => {
        task();
      },
      stop: () => {}
    };
    request = {
      submit: sinon.stub().callsFake(() => {
        return Promise.resolve({
          visitedUrls: [ url ],
          lastVisitedUrl: url,
          response: null
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

    it('should call request', () => {
      crawler.crawl({
        url,
        success,
        failure,
        finished
      });
      expect(createRequest.calledWith(null, url)).to.be.true;
    });
  });

  //TODO: Test different RequestSuccess values and how they are handled
  //TODO: On crawling finished callback "finished" is called, executor is stopped
});