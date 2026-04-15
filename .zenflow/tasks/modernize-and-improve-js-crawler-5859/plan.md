# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Agent Instructions

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: 4881b1e3-5878-43a0-9f97-bab18e9e5f03 -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Focus on **what** the feature should do and **why**, not **how** it should be built. Do not include technical implementation details, technology choices, or code-level decisions — those belong in the Technical Specification.

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification

Create a technical specification based on the PRD in `{@artifacts_path}/requirements.md`.

1. Review existing codebase architecture and identify reusable components
2. Define the implementation approach

Do not include implementation steps, phases, or task breakdowns — those belong in the Planning step.

Save to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach referencing existing code patterns
- Source code structure changes
- Data model / API / interface changes
- Verification approach using project lint/test commands

### [x] Step: Planning
<!-- chat-id: 48c6e8a4-b719-41e1-97f0-0a7a20b22184 -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

1. Break down the work into concrete tasks
2. Each task should reference relevant contracts and include verification steps
3. Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint). Avoid steps that are too granular (single function) or too broad (entire feature).

Important: unit tests must be part of each implementation task, not separate tasks. Each task should implement the code and its tests together, if relevant.

If the feature is trivial and doesn't warrant full specification, update this workflow to remove unnecessary steps and explain the reasoning to the user.

Save to `{@artifacts_path}/plan.md`.

### [ ] Step: Project scaffolding and build infrastructure

Set up the modern project foundation. All subsequent steps depend on this.

- Update `package.json`: version 2.0.0, `"type": "module"`, dual ESM/CJS exports, `engines: >=18`, new scripts (`build`, `test`, `test:coverage`, `e2e`, `lint`), replace all old dependencies with new ones (`cheerio`, `robots-parser`, `undici`, `typescript` ~5.x, `tsup`, `vitest`, `express`, `@types/express`)
- Update `.gitignore` to include `node_modules/`, `dist/`, `compiled/`, `*.log`, `.cache/`
- Create `tsconfig.json` per spec (target ES2022, strict, ESNext modules, bundler resolution)
- Create `tsup.config.ts` per spec (ESM+CJS, dts, sourcemap, target node18)
- Create `vitest.config.ts` per spec (include spec + e2e, v8 coverage with thresholds)
- Create `src/index.ts` entry point (re-exports Crawler as default + named, re-exports types)
- Create `src/types.ts` with all shared type definitions per spec (`CrawlPage`, `HttpResponse`, `CrawlerOptions`, `CrawlCallbackOptions`, `CrawlerEvents`, `CrawlerState`)
- Run `npm install`, `npm run build`, `npm run lint` to verify setup
- Delete old files: `karma.conf.js`, `tslint.json`, `spec/index.ts`

### [ ] Step: Configuration and state modules

Implement the foundational modules that other modules depend on.

- Rewrite `src/configuration.ts`: remove underscore, use object spread/destructuring, add all new options (requestTimeout, maxRetries, retryDelay, maxPages, selector, headers, respectRobotsTxt, debug), parse overloaded `crawl()` arguments, use plain empty functions instead of `_.noop`
- Write `spec/configuration.spec.ts`: test default values, option merging, callback parsing from overloaded crawl args
- Rewrite `src/state.ts`: replace underscore with native `Set`/`Map`, `visitedUrls: Set<string>`, `crawledUrls: Set<string>`, `beingCrawledUrls: Set<string>` for O(1) lookup, URL normalization via `new URL().href`, `pendingCount` atomic counter, `freeze()`/`defrost()` methods
- Write `spec/state.spec.ts`: test URL normalization, visited/crawled tracking, pendingCount, finished detection, freeze/defrost round-trip
- Verify: `npm test` passes for these modules

### [ ] Step: Executor module

Implement the rate-limited concurrent task executor.

- Rewrite `src/executor.ts`: replace setTimeout polling with event-driven token bucket, support `AbortSignal` for cancellation, `submit()` returns `Promise<void>`, `drain()` returns Promise resolving when queue empty and all tasks complete, track concurrent tasks with counter, rate limit via token refill at 100ms granularity
- Write `spec/executor.spec.ts`: test rate limiting (tasks don't exceed maxRatePerSecond), concurrency limiting, abort/stop behavior, queue draining, edge cases (submit after stop, empty queue)
- Verify: `npm test` passes

### [ ] Step: Request module

Implement HTTP request handling with undici.

- Rewrite `src/request.ts`: use `undici` with AbortSignal for timeout/cancellation, manual redirect following (maxRedirections: 0, follow manually up to 10) to track redirect chain, retry logic with configurable maxRetries/retryDelay, custom headers merged with User-Agent and Referer, return `HttpResponse` with `redirectUrls` populated
- Write `spec/request.spec.ts`: test successful request, failed request, timeout, retries (mock HTTP via vi.mock or undici MockAgent), redirect chain tracking, custom headers, abort signal cancellation
- Verify: `npm test` passes

### [ ] Step: Response module

Implement HTML parsing and link extraction with cheerio.

- Rewrite `src/response.ts`: use cheerio for HTML parsing and link extraction, support CSS selector scoping (`$(selector).find('a[href]')`), resolve relative URLs via `new URL(href, baseUrl)`, handle `<base>` tag, filter non-HTTP/HTTPS protocols, detect content type (text/html vs binary), handle encoding from Content-Type header charset
- Write `spec/response.spec.ts`: test link extraction, base tag resolution, selector scoping, binary content detection, encoding handling, edge cases (empty body, malformed HTML, no links, comment-embedded links)
- Verify: `npm test` passes

### [ ] Step: Robots.txt module

Implement robots.txt fetching and caching.

- Create `src/robots.ts`: `RobotsCache` class, cache parsed robots.txt per domain, `isAllowed(url, userAgent): Promise<boolean>`, graceful degradation on fetch failure, cache cleared on `forgetCrawled()`
- Write `spec/robots.spec.ts`: test parsing rules, caching (second call doesn't fetch again), graceful failure (network error = allow), different user agents, disallow matching
- Verify: `npm test` passes

### [ ] Step: Crawler class

Implement the core Crawler class that orchestrates all modules.

- Rewrite `src/crawler.ts`: extend EventEmitter, wire up configuration/state/executor/request/response/robots modules, implement `configure()` (fluent), `crawl()` with Promise API + callback overloads + options object overload, `stop()` via AbortController, `forgetCrawled()`, `freeze()`/`defrost()`, emit `page`/`error`/`finished` events, track `pendingCount` for completion detection (fix #60), `maxPages` limit (fix #22), debug logging (FR-11.1), depth-limited BFS crawl loop
- Update `src/index.ts` to export Crawler properly for both ESM and CJS
- Write `spec/crawler.spec.ts`: test full crawl flow with mocked request module — depth control, URL deduplication, shouldCrawl/shouldCrawlLinksFrom filtering, stop() mid-crawl, maxPages, Promise resolution, event emission, callback compatibility, freeze/defrost, debug mode, robots.txt integration
- Verify: `npm test` passes, `npm run build` succeeds, `npm run lint` passes

### [ ] Step: E2E tests

Create comprehensive end-to-end tests against a local Express server.

- Convert `e2e/server.js` to `e2e/server.ts` (TypeScript, Express)
- Move `e2e/static/` to `e2e/fixtures/` (or keep as `static/` if simpler)
- Convert `e2e/crawler.spec.js` to `e2e/crawler.e2e.spec.ts` (Vitest)
- Preserve all existing E2E scenarios: graph traversal (no cycles, simple cycle, one page), redirects (301/302/307), base tag, non-HTTP links, shouldCrawl
- Add new E2E tests:
  - [ ] Binary content (serve image, verify skipped in content but URL visited)
  - [ ] Request timeout (server endpoint with artificial delay > requestTimeout)
  - [ ] stop() mid-crawl (start crawl, call stop() after N pages)
  - [ ] maxPages limit (crawl with maxPages=3, verify only 3 pages)
  - [ ] robots.txt (serve robots.txt disallowing a path, verify not crawled)
  - [ ] CSS selector scoping (links in header + main, selector=".main", only main links followed)
  - [ ] Custom headers (verify server receives custom headers)
  - [ ] Retry behavior (server 500 on first request, 200 on retry)
  - [ ] Promise API (async/await, verify resolved value)
  - [ ] Event emitter API (verify page/error/finished events)
  - [ ] Freeze/defrost (crawl partially, freeze, new crawler, defrost, continue)
  - [ ] URL normalization edge cases (trailing slash, default port, mixed case host)
- Add necessary HTML fixtures in `e2e/fixtures/`
- Verify: `npm run e2e` passes all tests

### [ ] Step: Coverage, cleanup, and final verification

Ensure quality gates pass and clean up legacy artifacts.

- Run `npm run test:coverage` and verify thresholds (lines >90%, branches >85%, functions >90%)
- Fix any coverage gaps by adding missing test cases
- Delete legacy files that are no longer needed: root `crawler.ts`, `spec/util/util.ts`, `compiled/` directory (if exists)
- Verify all commands pass: `npm run lint`, `npm test`, `npm run e2e`, `npm run build`
- Verify the built package works: `dist/index.js` (ESM), `dist/index.cjs` (CJS), `dist/index.d.ts` (types) all exist and are valid
- Update `package.json` `files` field to include only `dist` and `README.md`
