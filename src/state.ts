import * as _ from 'underscore';

export interface StateChangeCallbacks {
  onCrawlingFinished: (crawledUrls: string[]) => void
}

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
    if (this.beingCrawledUrls.indexOf(url) < 0) {
      this.beingCrawledUrls.push(url);
    }
  }

  isBeingCrawled(url: string) {
    return _.contains(this.beingCrawledUrls, url);
  }

  rememberVisitedUrls(urls: string[]) {
    urls.forEach(url => {
      this.visitedUrls[url] = true;
    });
  }

  isVisitedUrl(url: string): boolean {
    return Boolean(this.visitedUrls[url]);
  }

  rememberCrawledUrl(url: string) {
    this.visitedUrls[url] = true;
    this.crawledUrls[url] = true;
  }

  finishedCrawling(url: string) {
    //console.log("Finished crawling url = ", url);
    //console.log("beingCrawledUrls = ", this.beingCrawledUrls);
    const indexOfUrl = this.beingCrawledUrls.indexOf(url);
  
    this.beingCrawledUrls.splice(indexOfUrl, 1);
    if (this.beingCrawledUrls.length === 0) {
      //console.log("Crawling finished!");
      this.callbacks.onCrawlingFinished(_.keys(this.crawledUrls));
    }
  }
}