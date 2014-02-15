js-crawler
==========

Web crawler for Node.JS

### Installation

```
npm install js-crawler
```

### Usage

The crawler provides intuitive interface to crawl links on web sites. Example:

```javascript
var Crawler = require("../crawler.js");

new Crawler().crawl("http://www.google.com", 3, function onSuccess(page) {
  console.log(page.url);
});
```


