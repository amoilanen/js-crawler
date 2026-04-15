export interface StateChangeCallbacks {
  onCrawlingFinished: (crawledUrls: string[]) => void;
}

const normalizeUrl = (url: string): string => new URL(url).href;

export default class State {
  /**
   * URLs the crawler has visited, including intermediate redirect URLs.
   * Not all visited URLs are reported in callbacks — only final URLs are.
   */
  visitedUrls: Set<string>;

  /**
   * URLs reported in success/failure callbacks.
   * A subset of visitedUrls; matches it iff there were no redirects.
   */
  crawledUrls: Set<string>;

  /**
   * URLs currently queued or being processed.
   */
  beingCrawledUrls: Set<string>;

  /**
   * Atomic counter tracking in-flight work.
   * Incremented when a URL is queued, decremented when processing completes.
   */
  pendingCount: number;

  private callbacks: StateChangeCallbacks;

  constructor(callbacks: StateChangeCallbacks) {
    this.callbacks = callbacks;
    this.visitedUrls = new Set();
    this.crawledUrls = new Set();
    this.beingCrawledUrls = new Set();
    this.pendingCount = 0;
  }

  clear(): this {
    this.visitedUrls.clear();
    this.crawledUrls.clear();
    this.beingCrawledUrls.clear();
    this.pendingCount = 0;
    return this;
  }

  startedCrawling(url: string): void {
    url = normalizeUrl(url);
    if (!this.beingCrawledUrls.has(url)) {
      this.beingCrawledUrls.add(url);
      this.pendingCount++;
    }
  }

  isBeingCrawled(url: string): boolean {
    return this.beingCrawledUrls.has(normalizeUrl(url));
  }

  rememberVisitedUrls(urls: string[]): void {
    for (const url of urls) {
      this.visitedUrls.add(normalizeUrl(url));
    }
  }

  isVisitedUrl(url: string): boolean {
    return this.visitedUrls.has(normalizeUrl(url));
  }

  rememberCrawledUrl(url: string): void {
    url = normalizeUrl(url);
    this.visitedUrls.add(url);
    this.crawledUrls.add(url);
  }

  finishedCrawling(url?: string): void {
    if (url !== undefined) {
      url = normalizeUrl(url);
      if (this.beingCrawledUrls.delete(url)) {
        this.pendingCount--;
      }
    }
    if (this.pendingCount <= 0) {
      this.pendingCount = 0;
      this.callbacks.onCrawlingFinished([...this.crawledUrls]);
    }
  }

  isFinished(): boolean {
    return this.pendingCount === 0 && this.beingCrawledUrls.size === 0;
  }

  freeze(): { visitedUrls: string[]; crawledUrls: string[] } {
    return {
      visitedUrls: [...this.visitedUrls],
      crawledUrls: [...this.crawledUrls],
    };
  }

  defrost(data: { visitedUrls: string[]; crawledUrls: string[] }): void {
    this.clear();
    for (const url of data.visitedUrls) {
      this.visitedUrls.add(url);
    }
    for (const url of data.crawledUrls) {
      this.crawledUrls.add(url);
    }
  }
}
