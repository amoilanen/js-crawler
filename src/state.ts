import * as _ from 'underscore';
import { URL } from 'url';

export interface StateChangeCallbacks {
  onCrawlingFinished: (crawledUrls: string[]) => void
}

const normalizeUrl = (url: string) =>
  new URL(url).href;

export default class State {

  /*
   * Urls that the Crawler has visited, as some pages may be in the middle of a redirect chain, not all the visitedUrls will be actually
   * reported in the onSuccess or onFailure callbacks, only the final urls in the corresponding redirect chains
   */
  visitedUrls: {[url: string]: boolean}

  /*
   * Urls that were reported in the onSuccess or onFailure callbacks. this.crawledUrls is a subset of this.visitedUrls, and matches it
   * iff there were no redirects while crawling.
   */
  crawledUrls: {[url: string]: boolean}

  /*
   * Urls that are queued for crawling, for some of them HTTP requests may not yet have been issued
   */
  beingCrawledUrls: string[]

  callbacks: StateChangeCallbacks

  constructor(callbacks: StateChangeCallbacks) {
    this.callbacks = callbacks;
    this.clear();
  }

  clear() {
    this.visitedUrls = {};
    this.crawledUrls = {};
    this.beingCrawledUrls = [];
    return this;
  }

  startedCrawling(url: string) {
    url = normalizeUrl(url);
    if (this.beingCrawledUrls.indexOf(url) < 0) {
      this.beingCrawledUrls.push(url);
    }
  }

  isBeingCrawled(url: string) {
    url = normalizeUrl(url);
    return _.contains(this.beingCrawledUrls, url);
  }

  rememberVisitedUrls(urls: string[]) {
    urls.forEach(url => {
      this.visitedUrls[normalizeUrl(url)] = true;
    });
  }

  isVisitedUrl(url: string): boolean {
    url = normalizeUrl(url);
    return Boolean(this.visitedUrls[url]);
  }

  rememberCrawledUrl(url: string) {
    url = normalizeUrl(url);
    this.visitedUrls[url] = true;
    this.crawledUrls[url] = true;
  }

  finishedCrawling(url?: string) {
    //console.log("Finished crawling url = ", url);
    //console.log("beingCrawledUrls = ", this.beingCrawledUrls);
    if (url !== undefined) {
      url = normalizeUrl(url);
    }
    const indexOfUrl = this.beingCrawledUrls.indexOf(url);
    if (indexOfUrl >= 0) {
      this.beingCrawledUrls.splice(indexOfUrl, 1);
    }
    if (this.beingCrawledUrls.length === 0) {
      //console.log("Crawling finished!");
      this.callbacks.onCrawlingFinished(_.keys(this.crawledUrls));
    }
  }
}