import { resolve } from 'url';
import * as _ from 'underscore';

export interface UrlCrawlingBehavior {
  ignoreRelative?: boolean;
  shouldCrawl: (link: string) => boolean
}

export interface Decodable {
  toString(encoding: string): string
}

export interface HttpResponse {
  headers: {
    [headerName: string]: string
  },
  body: Decodable,
  statusCode: number,
  request: {
    uri: {
      href: string
    }
  }
}

const BODY_PLACEHOLDER: string = '<<...non-text content (omitted by js-crawler)...>>'

export default class Response {
  response: HttpResponse

  constructor(response: HttpResponse) {
    this.response = response;
  }

  isTextHtml(): boolean {
    const { response } = this;
    const isContentTypeHeaderDefined = Boolean(response && response.headers && response.headers['content-type']);

    return isContentTypeHeaderDefined && response.headers['content-type'].startsWith('text/html');
  }

  decode(encoded: Decodable, encoding: string): string {
    const defaultEncoding = 'utf8';
    if (!encoding) {
      encoding = defaultEncoding;
    }

    let decodedBody: string;
    try {
      decodedBody = encoded.toString(encoding);
    } catch (decodingError) {
      decodedBody = encoded.toString(defaultEncoding);
    }
    return decodedBody;
  }

  getBody(): string {
    if (!this.isTextHtml()) {
      return BODY_PLACEHOLDER;
    }
    const { response } = this;
    const encoding = response.headers['content-encoding'];

    return this.decode(response.body, encoding);
  }

  stripComments(str: string): string {
    return str.replace(/<!--.*?-->/g, '');
  }

  getBaseUrl(responseUrl: string, body: string): string {

    /*
     * Resolving the base url following
     * the algorithm from https://www.w3.org/TR/html5/document-metadata.html#the-base-element
     */
    const baseUrlRegex = /<base href="(.*?)">/;
    const baseUrlInPage = body.match(baseUrlRegex);
    if (!baseUrlInPage) {
      return responseUrl;
    }
    const baseUrl = baseUrlInPage[1];

    return resolve(responseUrl, baseUrl);
  };

  isUrlProtocolSupported(link: string): boolean {
    return link.startsWith('http://') || link.startsWith('https://');
  }

  getHrefFrom(linkHtml: string): string {
    const match = /href=[\"\'](.*?)[#\"\']/i.exec(linkHtml);

    return match[1];
  }

  getAllUrls(responseUrl: string, body: string, behavior: UrlCrawlingBehavior): string[] {
    if (!this.isTextHtml()) {
      return [];
    }
    body = this.stripComments(body);
    const baseUrl = this.getBaseUrl(responseUrl, body);
    const linksRegex = behavior.ignoreRelative ? /<a[^>]+?href=["'].*?:\/\/.*?["']/gmi : /<a[^>]+?href=["'].*?["']/gmi;
    const links = body.match(linksRegex) || [];

    //console.log('body = ', body);
    const urls = _.chain(links)
      .map(link =>
        resolve(baseUrl, this.getHrefFrom(link))
      )
      .uniq()
      .filter(link =>
        this.isUrlProtocolSupported(link) && behavior.shouldCrawl(link)
      )
      .value();

    //console.log('urls to crawl = ', urls);
    return urls;
  };
}