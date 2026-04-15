# Product Requirements Document: js-crawler v2.0.0

## Overview

Modernize the js-crawler library from v1.x to v2.0.0 — a complete overhaul with modern tooling, improved reliability, a Promise/async-await API, and fixes for long-standing bugs reported by users.

## Goals

1. **Modern stack**: Replace deprecated dependencies (`request`, `underscore`), upgrade TypeScript, use modern build/test tooling
2. **Reliability**: Fix crawler stalling, timeout handling, and completion detection bugs
3. **Better API**: Promise-based API alongside the existing callback API
4. **Performance**: Correct rate limiting and concurrency control
5. **Excellent test coverage**: Unit + E2E tests covering all features and edge cases

## Non-Goals

- Headless Chrome/browser crawling engine (out of scope for v2.0.0, can be added later)
- RxJS/reactive API (out of scope, can be added as an extension)
- GUI or dashboard

---

## Functional Requirements

### FR-1: Core Crawling

- **FR-1.1**: Crawl web pages following HTTP/HTTPS links found in HTML content
- **FR-1.2**: Respect configurable crawl depth (default: 2)
- **FR-1.3**: Follow HTTP redirects and track redirect chains
- **FR-1.4**: Normalize URLs to avoid re-crawling duplicates (e.g., trailing slashes, default ports, case-insensitive scheme/host)
- **FR-1.5**: Extract links from `<a href>` attributes in HTML
- **FR-1.6**: Respect `<base>` tag when resolving relative URLs
- **FR-1.7**: Skip non-HTTP/HTTPS links (mailto:, javascript:, ftp:, etc.)
- **FR-1.8**: Handle both relative and absolute URLs; option to ignore relative URLs

### FR-2: Rate Limiting & Concurrency

- **FR-2.1**: Configurable maximum requests per second (`maxRequestsPerSecond`, default: 100)
- **FR-2.2**: Configurable maximum concurrent requests (`maxConcurrentRequests`, default: 10)
- **FR-2.3**: Both limits can be combined

### FR-3: Request Handling & Timeouts (addresses GitHub #47, #58, #59, #61)

- **FR-3.1**: Configurable per-request timeout (`requestTimeout`, default: 30000ms) — prevents crawler from hanging indefinitely on slow/unresponsive servers
- **FR-3.2**: Request retry with configurable retry count (`maxRetries`, default: 2) — addresses Backlog item about retrying failed URLs (addresses GitHub #47)
- **FR-3.3**: Configurable delay between retries (`retryDelay`, default: 1000ms)

### FR-4: Crawl Limits (addresses GitHub #22, #42)

- **FR-4.1**: Configurable maximum number of pages to crawl (`maxPages`) — stops crawling after visiting N pages regardless of remaining depth
- **FR-4.2**: `stop()` method to programmatically halt crawling at any time — the `finished` callback should still be called with URLs crawled so far

### FR-5: URL Filtering

- **FR-5.1**: `shouldCrawl(url)` — filter which URLs to visit
- **FR-5.2**: `shouldCrawlLinksFrom(url)` — filter which pages to extract links from
- **FR-5.3**: CSS selector-based link scoping (`selector` option) — only extract links within matching elements (addresses GitHub #15, #34)

### FR-6: Authentication (addresses GitHub #57)

- **FR-6.1**: Support custom headers via a `headers` configuration option (enables Basic Auth via `Authorization` header, cookies, etc.)

### FR-7: robots.txt Support (addresses GitHub #43)

- **FR-7.1**: Optional `respectRobotsTxt` config (default: false) — when enabled, fetch and parse `/robots.txt` for each domain before crawling
- **FR-7.2**: Respect `Disallow` rules matching the configured user agent

### FR-8: Content Handling

- **FR-8.1**: Return page content (HTML body) in success callbacks/results
- **FR-8.2**: Detect and skip binary content (images, audio, video) to save bandwidth (addresses Backlog item, GitHub #52) — use Content-Type header to identify non-text content
- **FR-8.3**: Support specifying response encoding (addresses GitHub #26)

### FR-9: State Management

- **FR-9.1**: Track all visited URLs (including redirects)
- **FR-9.2**: `forgetCrawled()` method to reset URL memory for reuse
- **FR-9.3**: Serialize/deserialize crawler state for pause/resume of large crawls (addresses GitHub #55) — `freeze()` returns a JSON-serializable state object, `defrost(state)` restores it

### FR-10: API Design

- **FR-10.1**: Promise-based API — `crawl()` returns a Promise that resolves when crawling is complete (addresses GitHub #27)
- **FR-10.2**: Event emitter pattern for per-page callbacks — `crawler.on('page', fn)`, `crawler.on('error', fn)`, `crawler.on('finished', fn)`
- **FR-10.3**: Backward-compatible callback API — existing callback and options-based calling conventions continue to work
- **FR-10.4**: Clean ES module and CommonJS exports — `import Crawler from 'js-crawler'` and `const Crawler = require('js-crawler')` both work without `.default` (addresses GitHub #56)
- **FR-10.5**: Fluent `configure()` method returns `this` for chaining

### FR-11: Debug Mode (addresses Backlog item)

- **FR-11.1**: `debug: true` option logs crawl progress (URLs being crawled, response status, errors) to console or a configurable logger

---

## Non-Functional Requirements

### NFR-1: Dependencies

- Replace `request` (deprecated) with a modern HTTP client (e.g., `undici`, native `fetch`, or `got`)
- Remove `underscore` dependency entirely — use native JS
- Minimize runtime dependency count

### NFR-2: TypeScript & Build

- Modern TypeScript (5.x)
- ESM + CJS dual output
- Type declarations included in package
- Modern bundler/compiler (esbuild, tsup, or tsc)

### NFR-3: Testing

- Modern test framework (Vitest or Jest)
- Unit tests for all modules with >90% line coverage
- E2E tests against a local Express server covering:
  - Simple page graphs (tree, cycle, acyclic)
  - Redirect chains
  - Binary content skipping
  - Depth limiting
  - Rate limiting behavior
  - Timeout handling
  - `stop()` mid-crawl
  - robots.txt compliance
  - Selector-based link extraction
  - URL normalization edge cases
- No browser-based test runner needed (Node.js only)

### NFR-4: Performance

- The executor/scheduler should not use `setTimeout` for rate limiting in a way that introduces unnecessary latency — use token bucket or similar efficient algorithm
- Memory usage should be bounded — don't accumulate unbounded state for very large crawls

### NFR-5: Correctness (addresses GitHub #50, #60)

- URL deduplication must work correctly (the old underscore-based `contains` was buggy — #50)
- `finished` callback must always fire, even for deep/long crawls (#60) — ensure proper tracking of in-flight requests

---

## Configuration Options Summary

| Option | Type | Default | Description |
|---|---|---|---|
| `depth` | number | 2 | Max link-follow depth |
| `ignoreRelative` | boolean | false | Skip relative URLs |
| `userAgent` | string | `'crawler/js-crawler'` | User-Agent header |
| `maxRequestsPerSecond` | number | 100 | Rate limit |
| `maxConcurrentRequests` | number | 10 | Concurrency limit |
| `requestTimeout` | number | 30000 | Per-request timeout (ms) |
| `maxRetries` | number | 2 | Retry count for failed requests |
| `retryDelay` | number | 1000 | Delay between retries (ms) |
| `maxPages` | number | undefined | Max pages to crawl |
| `shouldCrawl` | function | `() => true` | URL filter |
| `shouldCrawlLinksFrom` | function | `() => true` | Link extraction filter |
| `selector` | string | undefined | CSS selector to scope link extraction |
| `headers` | object | `{}` | Custom HTTP headers |
| `respectRobotsTxt` | boolean | false | Honor robots.txt |
| `debug` | boolean | false | Enable debug logging |

---

## Assumptions & Decisions

1. **No browser engine**: v2.0.0 remains a Node.js HTTP-based crawler. JavaScript-rendered pages (SPA) are not supported. This can be added as a plugin/option in a future version.
2. **robots.txt is opt-in**: Default `false` to maintain backward compatibility and simplicity for common use cases.
3. **Selector-based scoping**: Will use a lightweight HTML parser (like `cheerio`) only when `selector` is configured; regex-based extraction remains the default for performance.
4. **Freeze/defrost**: Serializes visited URLs and configuration only — in-flight requests are not preserved.
5. **`maxPages`**: Counts unique pages where the success callback fires, not total HTTP requests (redirects don't count toward the limit).
6. **Encoding**: The `page` object will include the detected encoding; users can override via a `encoding` option if needed.

---

## GitHub Issues Coverage

| Issue | Title | How Addressed |
|---|---|---|
| #15 | Selector to limit scope of crawled links | FR-5.3 |
| #22 | Limit number of pages | FR-4.1 |
| #27 | Promisify js-crawler | FR-10.1 |
| #34 | Evaluate selectors | FR-5.3 |
| #42 | Stop crawling | FR-4.2 |
| #43 | robots.txt | FR-7 |
| #47 | ETIMEDOUT and pending forever | FR-3.1, FR-3.2 |
| #50 | knownUrls incorrect underscore usage | NFR-5 (remove underscore entirely) |
| #52 | Crawl only images | FR-8.2 (content type filtering) |
| #55 | Freeze/defrost for resuming crawls | FR-9.3 |
| #56 | Crawler is not a function | FR-10.4 (clean exports) |
| #57 | Basic auth support | FR-6.1 |
| #58, #59, #61 | Crawler stops/stalls | FR-3.1, FR-4.2, NFR-5 |
| #60 | Finished callback not firing | NFR-5 |
