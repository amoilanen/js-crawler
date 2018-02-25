import { resolve as urlResolve } from 'url';
import * as _ from 'underscore';

export interface CrawlOptions {
  ignoreRelative: boolean;
  shouldCrawl: (link: string) => boolean
}

export default class Response {
  response: any

  //TODO: Provide real type of a response
  constructor(response: any) {
    this.response = response;
  }

  isTextHtml() {
    const { response } = this;

    return Boolean(response && response.headers && response.headers['content-type']
      && response.headers['content-type'].match(/^text\/html.*$/));
  }

  getBody() {
    if (!this.isTextHtml()) {
      return '<<...binary content (omitted by js-crawler)...>>';
    }

    const { response } = this;
    const defaultEncoding = 'utf8';
    var encoding = defaultEncoding;

    if (response.headers['content-encoding']) {
      encoding = response.headers['content-encoding'];
    }

    var decodedBody;
    try {
      decodedBody = response.body.toString(encoding);
    } catch (decodingError) {
      decodedBody = response.body.toString(defaultEncoding);
    }
    return decodedBody;
  }

  stripComments(str) {
    return str.replace(/<!--.*?-->/g, '');
  }

  getBaseUrl(defaultBaseUrl, body) {

    /*
     * Resolving the base url following
     * the algorithm from https://www.w3.org/TR/html5/document-metadata.html#the-base-element
     */
    var baseUrlRegex = /<base href="(.*?)">/;
    var baseUrlInPage = body.match(baseUrlRegex);
    if (!baseUrlInPage) {
      return defaultBaseUrl;
    }

    return urlResolve(defaultBaseUrl, baseUrlInPage[1]);
  };

  isLinkProtocolSupported(link) {
    return (link.indexOf('://') < 0 && link.indexOf('mailto:') < 0)
      || link.indexOf('http://') >= 0 || link.indexOf('https://') >= 0;
  }

  getAllUrls(defaultBaseUrl, body, options: CrawlOptions) {
    body = this.stripComments(body);
    var baseUrl = this.getBaseUrl(defaultBaseUrl, body);
    var linksRegex = options.ignoreRelative ? /<a[^>]+?href=["'].*?:\/\/.*?["']/gmi : /<a[^>]+?href=["'].*?["']/gmi;
    var links = body.match(linksRegex) || [];

    //console.log('body = ', body);
    var urls = _.chain(links)
      .map(function(link) {
        var match = /href=[\"\'](.*?)[#\"\']/i.exec(link);

        link = match[1];
        link = urlResolve(baseUrl, link);
        return link;
      })
      .uniq()
      .filter(link => {
        return this.isLinkProtocolSupported(link) && options.shouldCrawl(link);
      })
      .value();

    //console.log('urls to crawl = ', urls);
    return urls;
  };
}