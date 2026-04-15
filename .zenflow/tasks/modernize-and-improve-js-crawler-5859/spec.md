# Technical Specification: js-crawler v2.0.0

## Technical Context

### Current Stack (v1.x)
- **Language**: TypeScript 2.8, targeting ES2015/CommonJS
- **HTTP client**: `request` (deprecated) — callback-based, uses `this._redirect` internal
- **Utilities**: `underscore` — used for `_.noop`, `_.pick`, `_.contains`, `_.chain`, `_.map`, `_.uniq`, `_.filter`, `_.keys`, `_.unique`
- **Build**: `tsc` + `webpack` + `awesome-typescript-loader`
- **Tests**: Karma + Mocha + Chai + Sinon (unit), Mocha (E2E), ChromeHeadless
- **Output**: `compiled/` directory, CJS only

### Target Stack (v2.0.0)
- **Language**: TypeScript 5.x, targeting ES2022
- **HTTP client**: Node.js built-in `undici` (or native `fetch` available in Node 18+) — zero-dependency HTTP with redirect tracking, timeouts, abort signals
- **Utilities**: None — native JS (`Set`, `Map`, `Array` methods, `Object.keys`, `structuredClone`)
- **HTML parsing**: `cheerio` (lightweight, jQuery-like) — only runtime dependency, needed for selector-based link extraction (FR-5.3) and robust link parsing
- **robots.txt**: `robots-parser` — small, well-maintained library for robots.txt parsing
- **Build**: `tsup` (esbuild-based) — ESM + CJS dual output with declarations
- **Tests**: Vitest — fast, TypeScript-native, built-in coverage (c8/v8)
- **Output**: `dist/` directory, ESM + CJS dual package

### Runtime Dependencies (3 total)
| Package | Purpose | Size |
|---|---|---|
| `cheerio` | HTML parsing, link extraction, CSS selector scoping | ~200KB |
| `robots-parser` | robots.txt parsing | ~10KB |
| `undici` | HTTP client with timeouts, redirects, abort | ~400KB (ships with Node 18+ but explicit dep for compatibility) |

### Dev Dependencies
| Package | Purpose |
|---|---|
| `typescript` ~5.x | Compiler |
| `tsup` | Build (ESM+CJS) |
| `vitest` | Test framework + coverage |
| `express` | E2E test server |
| `@types/express` | Types for E2E server |

---

## Source Code Structure

### New Layout
```
src/
  index.ts              # Public API entry point, Crawler class (default export)
  crawler.ts            # Crawler class implementation
  configuration.ts      # Configuration management (rewrite, no underscore)
  executor.ts           # Rate-limited concurrent task executor (rewrite)
  request.ts            # HTTP request handling (rewrite with undici/fetch)
  response.ts           # Response parsing, link extraction (rewrite with cheerio)
  state.ts              # Crawl state tracking (rewrite, no underscore)
  robots.ts             # robots.txt fetching and caching
  types.ts              # Shared type definitions
spec/
  crawler.spec.ts       # Crawler integration tests
  configuration.spec.ts # Configuration unit tests
  executor.spec.ts      # Executor unit tests
  request.spec.ts       # Request unit tests
  response.spec.ts      # Response/link extraction unit tests
  state.spec.ts         # State management unit tests
  robots.spec.ts        # robots.txt unit tests
  helpers.ts            # Test utilities
e2e/
  crawler.e2e.spec.ts   # E2E tests (TypeScript, run via Vitest)
  server.ts             # Express test server
  fixtures/             # Static HTML test fixtures (rename from static/)
    ...existing fixtures + new ones...
dist/                   # Build output (gitignored)
  index.js              # ESM
  index.cjs             # CJS
  index.d.ts            # Type declarations
```

### Files to Delete
- `crawler.ts` (root) — moved to `src/crawler.ts`
- `karma.conf.js` — replaced by Vitest
- `tslint.json` — replaced by TypeScript strict mode (no separate linter needed)
- `compiled/` — replaced by `dist/`
- `spec/index.ts` — Vitest auto-discovers tests
- `spec/util/util.ts` — replaced by `spec/helpers.ts`

---

## Interface & Type Definitions

### types.ts — Shared Types

```typescript
export interface CrawlPage {
  url: string;
  status: number;
  content: string;
  error: Error | null;
  response: HttpResponse;
  body: string;
  referer: string;
}

export interface HttpResponse {
  headers: Record<string, string>;
  body: Buffer;
  statusCode: number;
  url: string;            // Final URL after redirects
  redirectUrls: string[]; // All URLs in redirect chain
}

export interface CrawlerOptions {
  depth?: number;                              // default: 2
  ignoreRelative?: boolean;                    // default: false
  userAgent?: string;                          // default: 'crawler/js-crawler'
  maxRequestsPerSecond?: number;               // default: 100
  maxConcurrentRequests?: number;              // default: 10
  requestTimeout?: number;                     // default: 30000 (ms)
  maxRetries?: number;                         // default: 2
  retryDelay?: number;                         // default: 1000 (ms)
  maxPages?: number;                           // default: undefined (unlimited)
  shouldCrawl?: (url: string) => boolean;      // default: () => true
  shouldCrawlLinksFrom?: (url: string) => boolean; // default: () => true
  selector?: string;                           // default: undefined (whole page)
  headers?: Record<string, string>;            // default: {}
  respectRobotsTxt?: boolean;                  // default: false
  debug?: boolean;                             // default: false
}

// Callback-style crawl options (backward compat)
export interface CrawlCallbackOptions {
  url: string;
  success?: (page: CrawlPage) => void;
  failure?: (page: CrawlPage) => void;
  finished?: (crawledUrls: string[]) => void;
}

export interface CrawlerEvents {
  page: (page: CrawlPage) => void;
  error: (page: CrawlPage) => void;
  finished: (crawledUrls: string[]) => void;
}

export interface CrawlerState {
  visitedUrls: string[];
  crawledUrls: string[];
  options: CrawlerOptions;
}
```

### Crawler Public API

```typescript
import { EventEmitter } from 'events';

export default class Crawler extends EventEmitter {
  constructor();

  // Configuration (fluent)
  configure(options: CrawlerOptions): this;

  // Start crawling — returns Promise, also supports callbacks
  // Overload 1: Promise API
  crawl(url: string): Promise<string[]>;
  // Overload 2: Callback API (backward compat)
  crawl(url: string, onSuccess?: SuccessCallback, onFailure?: FailureCallback, onFinished?: FinishedCallback): this;
  // Overload 3: Options object API (backward compat)
  crawl(options: CrawlCallbackOptions): this;

  // Control
  stop(): void;
  forgetCrawled(): void;

  // State serialization
  freeze(): CrawlerState;
  defrost(state: CrawlerState): void;
}
```

---

## Module-by-Module Implementation Approach

### src/index.ts — Entry Point
- Re-export Crawler as default and named export
- Re-export all public types
- Ensures `import Crawler from 'js-crawler'` and `const Crawler = require('js-crawler')` both work
- `tsup` config handles CJS interop with `default` export

### src/crawler.ts — Core Crawler (rewrite of root `crawler.ts`)

**Changes from v1:**
- Extends `EventEmitter` for event-based API (FR-10.2)
- `crawl()` returns a `Promise<string[]>` that resolves when finished (FR-10.1)
- Callbacks still supported — internally wired to events
- `stop()` method uses `AbortController` to cancel in-flight requests and stop the executor (FR-4.2)
- `maxPages` tracking — increment counter on each success callback, stop when reached (FR-4.1)
- `freeze()`/`defrost()` serialize/restore visited URLs and config (FR-9.3)
- Debug logging via configurable logger (FR-11.1)

**Key design: crawl completion tracking**
The v1 bug where `finished` never fires (#60) stems from race conditions in `beingCrawledUrls` tracking. The v2 approach:
- Use an atomic counter (`pendingCount`) instead of array manipulation
- Increment when a URL is queued, decrement when processing completes (success or failure)
- Fire `finished` when `pendingCount === 0` AND executor queue is empty
- The `stop()` method immediately resolves the crawl promise with URLs collected so far

### src/configuration.ts — Configuration (rewrite)

**Changes from v1:**
- Remove `underscore` — use object destructuring and spread
- Add new options: `requestTimeout`, `maxRetries`, `retryDelay`, `maxPages`, `selector`, `headers`, `respectRobotsTxt`, `debug`
- `updateAndReturnUrl()` logic simplified — parse overloaded `crawl()` arguments here
- No-op callbacks use plain empty functions instead of `_.noop`

### src/executor.ts — Task Executor (rewrite)

**Changes from v1:**
- Replace `setTimeout` polling loop with a proper event-driven approach:
  - Maintain a queue of pending tasks
  - Use a token bucket for rate limiting: refill tokens at `maxRatePerSecond` rate
  - When a task completes, immediately try to dequeue the next one (no unnecessary delay)
  - Track concurrent tasks with a simple counter
- Support `AbortSignal` for cancellation (used by `stop()`)
- `submit()` returns a `Promise<void>` so the caller can await task completion
- `drain()` method returns a Promise that resolves when queue is empty and all tasks complete

**Token bucket algorithm:**
```
- tokens: number (starts at maxRatePerSecond)
- lastRefill: timestamp
- On submit: if tokens > 0 and concurrency < max, execute immediately; else queue
- On task complete: try dequeue next
- Refill tokens periodically (setInterval at 100ms granularity)
- On stop: clear interval, reject pending
```

### src/request.ts — HTTP Requests (rewrite)

**Changes from v1:**
- Replace `request` module with `undici` (or Node.js native `fetch`)
- Use `undici.request()` with:
  - `signal: AbortSignal` for timeout and cancellation
  - `maxRedirections` for redirect following
  - Manual redirect tracking (collect each redirect URL)
- Retry logic: wrap request in retry loop with configurable `maxRetries` and `retryDelay`
- Custom `headers` merged with User-Agent and Referer
- Return `HttpResponse` with `redirectUrls` populated from redirect chain
- `encoding: null` equivalent: read body as `Buffer`, decode in response module

**Redirect tracking approach:**
`undici` supports `maxRedirections` but doesn't expose the chain. Alternative: set `maxRedirections: 0`, follow redirects manually collecting URLs, up to a max of 10 redirects. This gives full visibility into the chain (needed for FR-1.3 and state tracking).

### src/response.ts — Response Parsing (rewrite)

**Changes from v1:**
- Replace regex-based link extraction with `cheerio`:
  - Parse HTML once: `cheerio.load(body)`
  - If `selector` is configured, scope to `$(selector).find('a[href]')`; otherwise `$('a[href]')`
  - Extract `href` attribute directly — no regex needed
  - Resolve relative URLs using `new URL(href, baseUrl)`
- `<base>` tag: read via `$('base').attr('href')`
- URL protocol filtering: check `url.protocol` instead of string prefix matching
- Comment stripping: not needed — cheerio handles HTML correctly regardless of comments
- Content-type detection: check for `text/html` or `application/xhtml+xml`
- Encoding: detect from `Content-Type` header charset, fall back to utf-8
- Binary detection: if content-type doesn't start with `text/` or `application/`, treat as binary (FR-8.2)

### src/state.ts — State Management (rewrite)

**Changes from v1:**
- Replace `underscore` usage with native `Set` and `Map`
- `visitedUrls: Set<string>` instead of `{[url: string]: boolean}`
- `crawledUrls: Set<string>` instead of `{[url: string]: boolean}`
- `beingCrawledUrls: Set<string>` instead of `string[]` — O(1) lookup instead of O(n) indexOf
- URL normalization: use `new URL(url).href` (same as v1, this works well)
- `pendingCount: number` — atomic counter for tracking in-flight work
- `freeze()` / `defrost()` methods for serialization (FR-9.3)
- Remove `_.contains`, `_.keys` — use Set methods directly

### src/robots.ts — robots.txt Support (new)

- `RobotsCache` class: caches parsed robots.txt per domain
- `isAllowed(url: string, userAgent: string): Promise<boolean>` — fetch robots.txt for the domain (if not cached), parse with `robots-parser`, check if URL is allowed
- Cache TTL: for the duration of the crawl (cleared on `forgetCrawled()`)
- Graceful degradation: if robots.txt fetch fails, allow crawling (don't block on errors)

---

## Package Configuration

### package.json (key fields)
```json
{
  "name": "js-crawler",
  "version": "2.0.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist", "README.md"],
  "engines": { "node": ">=18.0.0" }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

### tsup.config.ts
```typescript
export default {
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node18'
};
```

### vitest.config.ts
```typescript
export default {
  test: {
    include: ['spec/**/*.spec.ts', 'e2e/**/*.e2e.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      thresholds: { lines: 90, branches: 85, functions: 90 }
    }
  }
};
```

---

## NPM Scripts

```json
{
  "build": "tsup",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "e2e": "vitest run e2e/",
  "lint": "tsc --noEmit",
  "prepublishOnly": "npm run build"
}
```

---

## Verification Approach

### Unit Tests (spec/)
Each module gets a corresponding spec file. Tests use Vitest's built-in mocking (`vi.fn()`, `vi.spyOn()`) instead of Sinon.

**Key test scenarios per module:**

- **configuration.spec.ts**: Default values, option merging, callback parsing from overloaded `crawl()` args
- **executor.spec.ts**: Rate limiting (tasks don't exceed maxRatePerSecond), concurrency limiting (no more than maxConcurrentTasks run simultaneously), abort/stop behavior, queue draining
- **request.spec.ts**: Successful request, failed request, timeout, retries (mock HTTP), redirect chain tracking, custom headers
- **response.spec.ts**: Link extraction from HTML, base tag resolution, CSS selector scoping, binary content detection, encoding handling, edge cases (empty body, malformed HTML, no links)
- **state.spec.ts**: URL normalization, visited/crawled tracking, pendingCount increment/decrement, finished callback firing, freeze/defrost round-trip
- **robots.spec.ts**: Parse and check robots.txt rules, caching, graceful failure
- **crawler.spec.ts**: Full crawl flow with mocked requests — depth control, URL deduplication, shouldCrawl/shouldCrawlLinksFrom filtering, stop(), maxPages, Promise resolution, event emission, callback compatibility

### E2E Tests (e2e/)
Run against a local Express server. Convert existing JS tests to TypeScript. Add new test cases:

- **Existing** (preserve): graph traversal, redirects (301/302/307), cycles, base tag, non-HTTP links, shouldCrawl
- **New**:
  - Binary content (serve an image, verify it's skipped in content but URL is visited)
  - Request timeout (server endpoint with artificial delay > requestTimeout)
  - stop() mid-crawl (start crawl, call stop() after N pages)
  - maxPages limit (crawl with maxPages=3, verify only 3 pages returned)
  - robots.txt (serve robots.txt that disallows a path, verify it's not crawled)
  - CSS selector scoping (page with links in header + main, selector=".main", verify only main links followed)
  - Custom headers (verify server receives custom headers)
  - Retry behavior (server returns 500 on first request, 200 on retry)
  - Promise API (use async/await, verify resolved value)
  - Event emitter API (verify page/error/finished events)
  - Freeze/defrost (crawl partially, freeze, create new crawler, defrost, continue)
  - URL normalization edge cases (trailing slash, default port, mixed case host)

### Coverage Target
- Lines: >90%
- Branches: >85%
- Functions: >90%

### Manual Verification
- `npm run build` — produces `dist/` with ESM, CJS, and `.d.ts`
- `npm test` — all unit tests pass
- `npm run e2e` — all E2E tests pass
- `npm run test:coverage` — meets thresholds
- `npm run lint` — no TypeScript errors
