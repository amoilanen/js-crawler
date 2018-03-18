const req = require('request');

import { resolve as urlResolve } from 'url';
import * as _ from 'underscore';
import { HttpResponse } from './response';

export interface RequestOptions {
  referer: string,
  url: string,
  userAgent: string
}

export interface RequestSuccess {
  visitedUrls: string[],
  lastVisitedUrl: string,
  response: HttpResponse
}

export interface RequestFailure {
  error: any,
  response: HttpResponse
}

interface Redirect {
  redirectUri: string
}

export default class Request {
  options: RequestOptions

  constructor(options: RequestOptions) {
    this.options = options;
  }

  submit(): Promise<RequestSuccess> {
    const { referer, url, userAgent } = this.options; 
    const requestOptions = {
      url: url,
      encoding: null, // Added by @tibetty so as to avoid request treating body as a string by default
      rejectUnauthorized : false,
      followRedirect: true,
      followAllRedirects: true,
      headers: {
        'User-Agent': userAgent,
        'Referer': referer
      }
    };
    return new Promise((resolve, reject) => {
      req(requestOptions, function(error, response: HttpResponse) {
        const visitedUrls =_.map(this._redirect.redirects,
          (redirect: Redirect) => redirect.redirectUri
        );
        //If no redirects, then response.request.uri.href === url, otherwise last url
        const lastVisitedUrl = response.request.uri.href;
        //console.log('lastUrlInRedirectChain = %s', lastUrlInRedirectChain);
        visitedUrls.push(url, lastVisitedUrl);
  
        if (!error && (response.statusCode === 200)) {
          resolve({
            visitedUrls: _.unique(visitedUrls),
            lastVisitedUrl,
            response
          });
        } else {
          reject({
            error,
            response
          });
        }
      });
    });
  }
}