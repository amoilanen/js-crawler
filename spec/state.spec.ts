import State from '../src/state';
const _ = require('underscore');
import * as sinon from 'sinon';
import { expect } from 'chai';

describe('state', () => {

  const urls = [
    'url1',
    'url2',
    'url3'
  ];
  const [ url1, url2, url3 ] = urls;
  let state: State;
  let onCrawlingFinished;

  beforeEach(() => {
    onCrawlingFinished = sinon.spy();
    state = new State({ onCrawlingFinished });
  });

  describe('empty state', () => {

    it('should have empty fields', () => {
      expect(Object.keys(state.visitedUrls)).to.be.empty;
      expect(Object.keys(state.crawledUrls)).to.be.empty;
      expect(state.beingCrawledUrls).to.be.empty;
    });
  });

  describe('startedCrawling & isBeingCrawled', () => {

    it('should add url to list or urls being crawled', () => {
      expect(state.isBeingCrawled(url1)).to.be.false;

      state.startedCrawling(url1);

      expect(state.isBeingCrawled(url1)).to.be.true;
      expect(state.beingCrawledUrls).to.eql([url1]);
    });

    it('should not store duplicates or urls being crawled', () => {
      state.startedCrawling(url1);
      state.startedCrawling(url1);
      state.startedCrawling(url1);

      expect(state.isBeingCrawled(url1)).to.be.true;
      expect(state.beingCrawledUrls).to.eql([url1]);
    });
  });

  describe('addVisitedUrls & isVisitedUrl', () => {

    it('should add all urls to the list of visited urls', () => {
      expect(state.isVisitedUrl(url1)).to.be.false;
      expect(state.isVisitedUrl(url2)).to.be.false;
      expect(state.isVisitedUrl(url3)).to.be.false;

      state.addVisitedUrls([url1, url2]);

      expect(state.isVisitedUrl(url1)).to.be.true;
      expect(state.isVisitedUrl(url2)).to.be.true;
      expect(state.isVisitedUrl(url3)).to.be.false;
      expect(state.visitedUrls).to.eql({
        [url1]: true,
        [url2]: true
      });
    });
  });

  describe('addCrawledUrl & isVisitedUrl', () => {

    it('should add url to the list of visited urls and crawled urls', () => {
      expect(state.isVisitedUrl(url1)).to.be.false;
      expect(state.isVisitedUrl(url2)).to.be.false;

      state.addCrawledUrl(url1);

      expect(state.isVisitedUrl(url1)).to.be.true;
      expect(state.isVisitedUrl(url2)).to.be.false;

      expect(state.visitedUrls).to.eql({
        [url1]: true
      });
      expect(state.crawledUrls).to.eql({
        [url1]: true
      });
    });
  });

  describe('finishedCrawling', () => {

    it('should be called when the only url was crawled', () => {
      state.startedCrawling(url1);
      state.addCrawledUrl(url1);
      state.finishedCrawling(url1);
      expect(onCrawlingFinished.calledWith([url1])).to.be.true;
    });

    it('should not call onCrawlingFinished when there are urls being crawled', () => {
      state.startedCrawling(url1);
      state.startedCrawling(url2);
      state.addCrawledUrl(url1);
      state.finishedCrawling(url1);
      expect(onCrawlingFinished.callCount).to.eql(0);
    });

    it('should be called when all urls were crawled', () => {
      urls.forEach(url => {
        state.startedCrawling(url);
        state.addCrawledUrl(url);
        state.finishedCrawling(url);
      });
      expect(onCrawlingFinished.calledWith(urls)).to.be.true;
    });

    it('should call onCrawlingFinished when urls have redirects', () => {
      // full redirect chain redirect1 -> redirect2 -> redirect3 -> url1
      const redirectUrls = ['redirect1', 'redirect2', 'redirect3'];
      state.startedCrawling('redirect1');
      state.addVisitedUrls(redirectUrls.concat([url1]));
      state.addCrawledUrl(url1);
      state.finishedCrawling('redirect1');
      expect(onCrawlingFinished.calledWith([ url1 ])).to.be.true;
    });
  });
});