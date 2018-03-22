import * as _ from 'underscore';

export interface StateChangeCallbacks {
  onCrawlingFinished: (crawledUrls: string[]) => void
}

export default class State {

  /*
   * Urls that the Crawler has visited, as some pages may be in the middle of a redirect chain, not all the knownUrls will be actually
   * reported in the onSuccess or onFailure callbacks, only the final urls in the corresponding redirect chains
   */
  knownUrls: {[url: string]: boolean}

  /*
   * Urls that were reported in the onSuccess or onFailure callbacks. this.crawledUrls is a subset of this.knownUrls, and matches it
   * iff there were no redirects while crawling.
   */
  crawledUrls: string[]

  /*
   * Urls that are queued for crawling, for some of them HTTP requests may not yet have been issued
   */
  _currentUrlsToCrawl: string[]

  callbacks: StateChangeCallbacks

  constructor(callbacks: StateChangeCallbacks) {
    this.callbacks = callbacks;
    this.knownUrls = {};
    this.crawledUrls = [];
    this._currentUrlsToCrawl = [];
  }

  clear() {
    this.knownUrls = {};
    this.crawledUrls = [];
    this._currentUrlsToCrawl = [];
    return this;
  }

  startedCrawling(url: string) {
    if (this._currentUrlsToCrawl.indexOf(url) < 0) {
      this._currentUrlsToCrawl.push(url);
    }
  }

  addVisitedUrls(urls: string[]) {
    urls.forEach(url => {
      this.knownUrls[url] = true;
    });
  }

  addCrawledUrl(url: string) {
    this.knownUrls[url] = true;
    this.crawledUrls.push(url);
  }

  isNewUrl(url: string) {
    return !_.contains(this._currentUrlsToCrawl, url) && !_.contains(_.keys(this.knownUrls), url);
  }

  isVisitedUrl(url: string) {
    return _.contains(_.keys(this.knownUrls), url);
  }

  finishedCrawling(url: string) {
    //console.log("Finished crawling url = ", url);
    //console.log("_currentUrlsToCrawl = ", this._currentUrlsToCrawl);
    const indexOfUrl = this._currentUrlsToCrawl.indexOf(url);
  
    this._currentUrlsToCrawl.splice(indexOfUrl, 1);
    if (this._currentUrlsToCrawl.length === 0) {
      //console.log("Crawling finished!");
      this.callbacks.onCrawlingFinished(this.crawledUrls);
    }
  }
}