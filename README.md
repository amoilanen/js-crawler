js-crawler
==========

Web crawler for Node.JS, both HTTP and HTTPS are supported.

## Installation

```
npm install js-crawler
```

## Usage

The crawler provides intuitive interface to crawl links on web sites. Example:

```javascript
var Crawler = require("js-crawler");

new Crawler().configure({depth: 3})
  .crawl("http://www.google.com", function onSuccess(page) {
    console.log(page.url);
  });
```

The call to `configure` is optional, if it is omitted the default option values will be used.

`onSuccess` callback will be called for each page that the crawler has crawled. `page` value passed to the callback will contain the following fields:

* `url` - URL of the page
* `content` - body of the page (usually HTML)
* `status` - the HTTP status code

Extra information can be retrieved from the rest of the `page` fields: `error`, `response`, `body` which are identical to the ones passed to the callback of `request` invocation of the [Request](https://github.com/mikeal/request) module.
`referer` field will reference the url of the page that lead the crawler to the current page.

#### Options-based API

Alternative APIs for passing callbacks to the `crawl` function.

```javascript
var Crawler = require("js-crawler");

var crawler = new Crawler().configure({ignoreRelative: false, depth: 2});

crawler.crawl({
  url: "https://github.com",
  success: function(page) {
    console.log(page.url);
  },
  failure: function(page) {
    console.log(page.status);
  },
  finished: function(crawledUrls) {
    console.log(crawledUrls);
  }
});
```

#### Handling errors

It is possible to pass an extra callback to handle errors, consider the modified example above:

```javascript
var Crawler = require("js-crawler");

new Crawler().configure({depth: 3})
  .crawl("http://www.google.com", function(page) {
    console.log(page.url);
  }, function(response) {
    console.log("ERROR occurred:");
    console.log(response.status);
    console.log(response.url);
    console.log(response.referer);
  });
```

Here the second callback will be called for each page that could not be accessed (maybe because the corresponding site is down). `status` may be not defined.

#### Knowing when all crawling is finished

Extra callback can be passed that will be called when all the urls have been crawled and crawling has finished.
All crawled urls will be passed to that callback as an argument.

```javascript
var Crawler = require("js-crawler");

new Crawler().configure({depth: 2})
  .crawl("http://www.google.com", function onSuccess(page) {
    console.log(page.url);
  }, null, function onAllFinished(crawledUrls) {
    console.log('All crawling finished');
    console.log(crawledUrls);
  });
```

#### Limiting the rate at which requests are made

##### maxRequestsPerSecond option

By default the maximum number of HTTP requests made per second is 100, but this can be adjusted by using the option `maxRequestsPerSecond` if one wishes not to use too much of network or, opposite, wishes for yet faster crawling.

```javascript
var Crawler = require("js-crawler");

var crawler = new Crawler().configure({maxRequestsPerSecond: 2});

crawler.crawl({
  url: "https://github.com",
  success: function(page) {
    console.log(page.url);
  },
  failure: function(page) {
    console.log(page.status);
  }
});
```

With this configuration only at most 2 requests per second will be issued. The actual request rate depends on the network speed as well, `maxRequestsPerSecond` configures just the upper boundary.

`maxRequestsPerSecond` can also be fractional, the value `0.1`, for example, would mean maximum one request per 10 seconds.

##### maxConcurrentRequests option

Even more flexibility is possible when using `maxConcurrentRequests` option, it limits the number of HTTP requests that can be active simultaneously.
If the number of requests per second is too high for a given set of sites/network requests may start to pile up, then specifying `maxConcurrentRequests`
can help ensure that the network is not overloaded with piling up requests.

##### Specifying both options

It is possible to customize both options in case we are not sure how performant the network and sites are. Then `maxRequestsPerSecond` limits how many requests the crawler is allowed to make and `maxConcurrentRequests` allows to specify how should the crawler adjust its rate of requests depending on the real-time performance of the network/sites.

```javascript
var Crawler = require("js-crawler");

var crawler = new Crawler().configure({
  maxRequestsPerSecond: 10,
  maxConcurrentRequests: 5
});

crawler.crawl({
  url: "https://github.com",
  success: function(page) {
    console.log(page.url);
  },
  failure: function(page) {
    console.log(page.status);
  }
});
```

##### Default option values

By default the values are as follows:

`maxRequestsPerSecond` 100

`maxConcurrentRequests` 10

That is, we expect on average that 100 requests will be made every second and only 10 will be running concurrently, and every request will take something like 100ms to complete.

#### Reusing the same crawler instance for repeated crawling: forgetting crawled urls

By default a crawler instance will remember all the urls it ever crawled and will not crawl them again. In order to make it forget all the crawled urls the method `forgetCrawled` can be used. There is another way to solve the same problem: create a new instance of a crawler. Example https://github.com/antivanov/js-crawler/blob/master/examples/github_forgetting_crawled_urls.js

#### Supported options

* `depth` - the depth to which the links from the original page will be crawled.
Example: if `site1.com` contains a link to `site2.com` which contains a link to `site3.com`, `depth` is 2 and we crawl from `site1.com` then we will crawl `site2.com` but will not crawl `site3.com` as it will be too deep. 

The default value is `2`.

* `ignoreRelative` - ignore the relative URLs, the relative URLs on the same page will be ignored when crawling, so `/wiki/Quick-Start` will not be crawled and `https://github.com/explore` will be crawled. This option can be useful when we are mainly interested in sites to which the current sites refers and not just different sections of the original site.

The default value is `false`.

* `userAgent` - User agent to send with crawler requests.

The default value is `crawler/js-crawler`

* `maxRequestsPerSecond` - the maximum number of HTTP requests per second that can be made by the crawler, default value is 100

* `maxConcurrentRequests` - the maximum number of concurrent requests that should not be exceeded by the crawler, the default value is 10

* `shouldCrawl` - function that specifies whether a url should be crawled/requested, returns `true` or `false`,
argument is the current `url` the crawler considers for crawling

* `shouldCrawlLinksFrom` - function that specifies whether the crawler should crawl links found at a given url, returns `true` or `false`, argument is the current `url` being crawled

Note: `shouldCrawl` determines if a given URL should be requested/visited at all, where as `shouldCrawlLinksFrom` determines if the links on a given URL should be harvested/added to the crawling queue. Many users may find that using `shouldCrawl` is sufficient, as links from a page cannot be crawled if the page is never visited/requested in the first place. A common use case for having these functions separated: if a user would like to check external links on a site for errors without crawling those external links, the user could create a `shouldCrawlLinksFrom` function that restricts crawling to the original url without visiting external links.


**Examples:**

The following will crawl the specified URL, but not allow external URLs to be visited/requested, and therefore not search for additional links to crawl on the external URLs:
```javascript
var Crawler = require("js-crawler");

var crawler = new Crawler().configure({
  shouldCrawl: function(url) {
    return url.indexOf("reddit.com") < 0;
  }
});

crawler.crawl("http://www.reddit.com/r/javascript", function(page) {
  console.log(page.url);
});
```

The following will crawl the specified URL, allow external URLs to be visited/requested, but will not search for additional links to crawl on the external URLs:
```javascript
var Crawler = require("js-crawler");

var crawler = new Crawler().configure({
  shouldCrawlLinksFrom: function(url) {
    return url.indexOf("reddit.com") < 0;
  }
});

crawler.crawl("http://www.reddit.com/r/javascript", function(page) {
  console.log(page.url);
});
```

The default value for each is a function that always returns `true`.

#### Development

Install dependencies

`npm install`

Running the build

`grunt`

##### Unit tests

`grunt karma:unit`

launches unit tests in the console mode

`grunt karma:unit_browser`

launches a browser in which unit tests can be debugged

##### End-to-end tests

`jasmine-node` and `express` are used to setup and run end-to-end tests

Install jasmine-node and express globablly

```
npm install -g jasmine-node
npm install -g express
```

Start the end-to-end target server

```
cd e2e
node server.js
```

Now the server runs on the port 3000.
Run the end-to-end specs:

```
jasmine-node e2e/
```

## License

MIT License
(c) [Anton Ivanov](http://smthngsmwhr.wordpress.com/)

Credits
---------------

The crawler depends on the following Node.JS modules:

* [Underscore.js]
* [Request]

[Underscore.js]: http://underscorejs.org/
[Request]: https://github.com/mikeal/request