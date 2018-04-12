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

  beforeEach(() => {
    state = new State(null);
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
});