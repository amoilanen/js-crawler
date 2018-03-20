import * as _ from 'underscore';
import { HttpResponse } from './response';

export interface UrlCrawlingResult {
  url: string,
  status: number,
  content: string,
  error: any,
  response: HttpResponse,
  body: string,
  referer: string
}

export type onSuccessCallback = (crawlingResult: UrlCrawlingResult) => void;
export type onFailureCallback = (crawlingResult: UrlCrawlingResult) => void;
export type onAllFinishedCallback = (crawledUrls: string[]) => void;


export interface CrawlingOptions {
  depth: number;
  ignoreRelative: boolean;
  userAgent: string;
  maxConcurrentRequests: number;
  maxRequestsPerSecond: number;
  shouldCrawl: (url: string) => boolean;
  shouldCrawlLinksFrom: (url: string) => boolean;
}

export interface CrawlingCallbacks {
  onSuccess: onSuccessCallback;
  onFailure: onFailureCallback;
  onAllFinished: onAllFinishedCallback;
}

export type ConfigurationOptions = CrawlingOptions & CrawlingCallbacks;

export interface CrawlOptions {
  success: onSuccessCallback;
  failure: onFailureCallback;
  finished: onAllFinishedCallback;
  url: string;
}

const DEFAULT_DEPTH = 2;
const DEFAULT_MAX_CONCURRENT_REQUESTS = 10;
const DEFAULT_MAX_REQUESTS_PER_SECOND = 100;
const DEFAULT_USERAGENT = 'crawler/js-crawler';

const DEFAULT_OPTIONS: ConfigurationOptions = {
  depth: DEFAULT_DEPTH,
  ignoreRelative: false,
  userAgent: DEFAULT_USERAGENT,
  maxConcurrentRequests: DEFAULT_MAX_CONCURRENT_REQUESTS,
  maxRequestsPerSecond: DEFAULT_MAX_REQUESTS_PER_SECOND,
  shouldCrawl: url => true,
  shouldCrawlLinksFrom: url => true,
  onSuccess: _.noop,
  onFailure: _.noop,
  onAllFinished: _.noop
};

export default class Configuration {

  options: ConfigurationOptions;

  configure(options: ConfigurationOptions) {
    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    this.options.depth = Math.max(this.options.depth, 0);
  }

  get crawlingOptions(): CrawlingOptions {
    return _.pick(this.options, [
      'depth', 'ignoreRelative', 'userAgent', 'maxConcurrentRequests', 'maxRequestsPerSecond', 'shouldCrawl', 'shouldCrawlLinksFrom'
    ]);
  }

  get crawlingCallbacks(): CrawlingCallbacks {
    return _.pick(this.options, [
      'onSuccess', 'onFailure', 'onAllFinished'
    ]);
  }

  updateAndReturnUrl(urlOrOptions: CrawlOptions & { url: string} | string,
      onSuccess?: onSuccessCallback,
      onFailure?: onFailureCallback,
      onAllFinished?: onAllFinishedCallback) {
    if (typeof urlOrOptions !== 'string') {
      const options: CrawlOptions = urlOrOptions;
      const optionsUpdate = {
        onSuccess: options.success || _.noop,
        onFailure: options.failure || _.noop,
        onAllFinished: options.finished || _.noop
      };
      this.options = Object.assign({}, this.options, optionsUpdate);
      return urlOrOptions.url;
    } else {
      const url = urlOrOptions;
      const optionsUpdate = {
        onSuccess: onSuccess || _.noop,
        onFailure: onFailure || _.noop,
        onAllFinished: onAllFinished || _.noop
      };
      this.options = Object.assign({}, this.options, optionsUpdate);
      return url;
    }
  }
}