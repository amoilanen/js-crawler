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
var Crawler = require("../crawler.js");

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

#### Handling errors

It is possible to pass an extra callback to handle errors, consider the modified example above:

```javascript
var Crawler = require("../crawler.js");

new Crawler().configure({depth: 3})
  .crawl("http://www.google.com", function(page) {
    console.log(page.url);
  }, function(response) {
    console.log("ERROR occurred:");
    console.log(response.status);
    console.log(response.url);
  });
```

Here the second callback will be called for each page that could not be accessed (maybe because the corresponding site is down). `status` may be not defined.

#### Supported options

* `depth` - the depth to which the links from the original page will be crawled.
Example: if `site1.com` contains a link to `site2.com` which contains a link to `site3.com`, `depth` is 2 and we crawl from `site1.com` then we will crawl `site2.com` but will not crawl `site3.com` as it will be too deep. 

The default value is `2`.

* `ignoreRelative` - ignore the relative URLs, the relative URLs on the same page will be ignored when crawling, so `/wiki/Quick-Start` will not be crawled and `https://github.com/explore` will be crawled. This option can be useful when we are mainly interested in sites to which the current sites refers and not just different sections of the original site.

The default value is `false`.

* `shouldCrawl` - function that specifies whether an url should be crawled, returns `true` or `false`.

Example:

```javascript
var Crawler = require("../crawler.js");

var crawler = new Crawler().configure({
  shouldCrawl: function(url) {
    return url.indexOf("reddit.com") < 0;
  }
});

crawler.crawl("http://www.reddit.com/r/javascript", function(page) {
  console.log(page.url);
});
```

Default value is a function that always returns `true`.

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