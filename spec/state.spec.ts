import State from '../src/state';
const _ = require('underscore');
import * as sinon from 'sinon';
import { expect } from 'chai';

describe('state', () => {

  const urls = [
    'http://url1/',
    'http://url2/',
    'http://url3/'
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

    it('should add url to list of urls being crawled', () => {
      expect(state.isBeingCrawled(url1)).to.be.false;

      state.startedCrawling(url1);

      expect(state.isBeingCrawled(url1)).to.be.true;
      expect(state.beingCrawledUrls).to.eql([url1]);
    });

    describe('url normalization', () => {

      it('should normalize url when starting crawling', () => {
        state.startedCrawling('http://url');
  
        expect(state.isBeingCrawled('http://url/')).to.be.true;
        expect(state.beingCrawledUrls).to.eql(['http://url/']);
      });

      it('should normalize url when checking if it is being crawled', () => {
        state.startedCrawling('http://url/');
  
        expect(state.isBeingCrawled('http://url')).to.be.true;
        expect(state.beingCrawledUrls).to.eql(['http://url/']);
      });
    });

    it('should not store duplicates or urls being crawled', () => {
      state.startedCrawling(url1);
      state.startedCrawling(url1);
      state.startedCrawling(url1);

      expect(state.isBeingCrawled(url1)).to.be.true;
      expect(state.beingCrawledUrls).to.eql([url1]);
    });
  });

  describe('rememberVisitedUrls & isVisitedUrl', () => {

    it('should add all urls to the list of visited urls', () => {
      expect(state.isVisitedUrl(url1)).to.be.false;
      expect(state.isVisitedUrl(url2)).to.be.false;
      expect(state.isVisitedUrl(url3)).to.be.false;

      state.rememberVisitedUrls([url1, url2]);

      expect(state.isVisitedUrl(url1)).to.be.true;
      expect(state.isVisitedUrl(url2)).to.be.true;
      expect(state.isVisitedUrl(url3)).to.be.false;
      expect(state.visitedUrls).to.eql({
        [url1]: true,
        [url2]: true
      });
    });

    describe('url normalization', () => {

      it('should normalize url when remembering visited url', () => {
        state.rememberVisitedUrls(['http://url']);
  
        expect(state.isVisitedUrl('http://url/')).to.be.true;
        expect(state.visitedUrls).to.eql({
          ['http://url/']: true
        });
      });

      it('should normalize url when checking if it was visited', () => {
        state.rememberVisitedUrls(['http://url/']);
  
        expect(state.isVisitedUrl('http://url')).to.be.true;
        expect(state.visitedUrls).to.eql({
          ['http://url/']: true
        });
      });
    });
  });

  describe('rememberCrawledUrl & isVisitedUrl', () => {

    it('should add url to the list of visited urls and crawled urls', () => {
      expect(state.isVisitedUrl(url1)).to.be.false;
      expect(state.isVisitedUrl(url2)).to.be.false;

      state.rememberCrawledUrl(url1);

      expect(state.isVisitedUrl(url1)).to.be.true;
      expect(state.isVisitedUrl(url2)).to.be.false;

      expect(state.visitedUrls).to.eql({
        [url1]: true
      });
      expect(state.crawledUrls).to.eql({
        [url1]: true
      });
    });

    describe('url normalization', () => {

      it('should normalize url when remembering visited url', () => {
        state.rememberCrawledUrl('http://url');
  
        expect(state.isVisitedUrl('http://url/')).to.be.true;
        expect(state.visitedUrls).to.eql({
          ['http://url/']: true
        });
        expect(state.crawledUrls).to.eql({
          ['http://url/']: true
        });
      });
    });
  });

  describe('finishedCrawling', () => {

    it('should be called when the only url was crawled', () => {
      state.startedCrawling(url1);
      state.rememberCrawledUrl(url1);
      state.finishedCrawling(url1);
      expect(onCrawlingFinished.calledWith([url1])).to.be.true;
    });

    it('should not be called if started and finished urls are different', () => {
      state.startedCrawling(url1);
      state.rememberCrawledUrl(url1);
      state.finishedCrawling(url2);
      sinon.assert.notCalled(onCrawlingFinished);
    });

    it('should not call onCrawlingFinished when there are urls being crawled', () => {
      state.startedCrawling(url1);
      state.startedCrawling(url2);
      state.rememberCrawledUrl(url1);
      state.finishedCrawling(url1);
      expect(onCrawlingFinished.callCount).to.eql(0);
    });

    it('should be called when all urls were crawled', () => {
      urls.forEach(url => {
        state.startedCrawling(url);
        state.rememberCrawledUrl(url);
        state.finishedCrawling(url);
      });
      expect(onCrawlingFinished.calledWith(urls)).to.be.true;
    });

    it('should call onCrawlingFinished when urls have redirects', () => {
      // full redirect chain redirect1 -> redirect2 -> redirect3 -> url1
      const redirectUrls = ['http://redirect1', 'http://redirect2', 'http://redirect3', url1];
      state.startedCrawling('http://redirect1');
      state.rememberVisitedUrls(redirectUrls);
      state.rememberCrawledUrl(url1);
      state.finishedCrawling('http://redirect1');
      expect(onCrawlingFinished.calledWith([ url1 ])).to.be.true;
    });

    it('should ignore finishedCrawling if url is not being actively crawled', () => {
      state.finishedCrawling(url1);
      expect(state.beingCrawledUrls).to.eql([]);
    });

    it('should be callable without arguments', () => {
      state.finishedCrawling();
      expect(onCrawlingFinished.calledWith([]));
    });

    describe('normalization', () => {

      it('should be called with the normalized version of the url', () => {
        state.startedCrawling('http://url/');
        state.rememberCrawledUrl('http://url/');
        state.finishedCrawling('http://url');
        expect(onCrawlingFinished.calledWith(['http://url/'])).to.be.true;
      });
    });
  });
});