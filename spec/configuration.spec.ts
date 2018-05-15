import { default as Configuration, DEFAULT_OPTIONS } from '../src/configuration';
const _ = require('underscore');
import { expect } from 'chai';

describe('configuration', () => {

  const url = 'url';
  let configuration: Configuration;

  describe('default options', () => {

    const nonDefaultDepth = 100;

    beforeEach(() => {
      configuration = new Configuration();
      configuration.configure({
        depth: nonDefaultDepth
      });
    })

    it('should use defaults if value is missing', () => {
      expect(configuration.options.depth).to.eql(nonDefaultDepth);
      expect(configuration.options.maxConcurrentRequests).to.eql(DEFAULT_OPTIONS.maxConcurrentRequests);
    });

    it('should crawl all urls by default', () => {
      expect(configuration.options.shouldCrawl(url)).to.eql(true);
    });

    it('should crawl links from all the urls by default', () => {
      expect(configuration.options.shouldCrawlLinksFrom(url)).to.eql(true);
    });
  });

  describe('depth option', () => {

    it('should use 0 if value is negative', () => {
      configuration = new Configuration();
      configuration.configure({
        depth: -1
      });

      expect(configuration.options.depth).to.eql(0);
    });
  });

  describe('properties', () => {

    it('should return "options"', () => {
      configuration = new Configuration();
      expect(configuration.options).to.eql(_.omit(DEFAULT_OPTIONS, ['success', 'failure', 'finished']));
    });

    it('should return "crawlingBehavior"', () => {
      configuration = new Configuration();
      expect(configuration.crawlingBehavior).to.eql(_.pick(DEFAULT_OPTIONS, ['ignoreRelative', 'shouldCrawl']));
    });

    it('should return "callbacks"', () => {
      configuration = new Configuration();
      expect(configuration.callbacks).to.eql(_.pick(DEFAULT_OPTIONS, ['success', 'failure', 'finished']));
    });
  });

  describe('update crawling callbacks and return url', () => {

    const success = _.noop;
    const failure = _.noop;
    const finished = _.noop;

    it('should allow to provide options as separate arguments', () => {
      configuration = new Configuration();
      const returnedUrl = configuration.updateAndReturnUrl(url, success, failure, finished);
      expect(returnedUrl).to.eql(url);
      expect(configuration.callbacks).to.eql({
        success,
        failure,
        finished
      })
    });

    it('should allow to use the options API', () => {
      configuration = new Configuration();
      const returnedUrl = configuration.updateAndReturnUrl({url, success, failure, finished});
      expect(returnedUrl).to.eql(url);
      expect(configuration.callbacks).to.eql({
        success,
        failure,
        finished
      })
    });
  });
});