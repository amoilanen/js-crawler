import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAgent } from 'undici';
import { RobotsCache } from '../src/robots.js';

describe('RobotsCache', () => {
  let mockAgent: MockAgent;

  beforeEach(() => {
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
  });

  afterEach(async () => {
    await mockAgent.close();
  });

  function mockRobotsTxt(origin: string, body: string, statusCode = 200) {
    const pool = mockAgent.get(origin);
    pool.intercept({ path: '/robots.txt', method: 'GET' }).reply(statusCode, body);
  }

  it('should allow URLs when no robots.txt rules disallow them', async () => {
    mockRobotsTxt('http://example.com', 'User-agent: *\nAllow: /\n');

    const cache = new RobotsCache({ userAgent: 'TestBot', dispatcher: mockAgent });
    const allowed = await cache.isAllowed('http://example.com/page');

    expect(allowed).toBe(true);
  });

  it('should disallow URLs matching Disallow rules', async () => {
    mockRobotsTxt('http://example.com', 'User-agent: *\nDisallow: /private/\n');

    const cache = new RobotsCache({ userAgent: 'TestBot', dispatcher: mockAgent });

    expect(await cache.isAllowed('http://example.com/private/secret')).toBe(false);
    expect(await cache.isAllowed('http://example.com/public/page')).toBe(true);
  });

  it('should respect user-agent specific rules', async () => {
    const robotsTxt = [
      'User-agent: GoodBot',
      'Allow: /',
      '',
      'User-agent: BadBot',
      'Disallow: /',
    ].join('\n');
    mockRobotsTxt('http://example.com', robotsTxt);

    const goodBot = new RobotsCache({ userAgent: 'GoodBot', dispatcher: mockAgent });
    expect(await goodBot.isAllowed('http://example.com/page')).toBe(true);
  });

  it('should match specific user-agent disallow rules', async () => {
    const robotsTxt = [
      'User-agent: GoodBot',
      'Allow: /',
      '',
      'User-agent: BadBot',
      'Disallow: /',
    ].join('\n');
    mockRobotsTxt('http://example.com', robotsTxt);

    const badBot = new RobotsCache({ userAgent: 'BadBot', dispatcher: mockAgent });
    expect(await badBot.isAllowed('http://example.com/page')).toBe(false);
  });

  it('should cache robots.txt per domain (second call does not fetch again)', async () => {
    // Only one intercept — if a second fetch happens, undici will throw
    mockRobotsTxt('http://example.com', 'User-agent: *\nDisallow: /blocked/\n');

    const cache = new RobotsCache({ userAgent: 'TestBot', dispatcher: mockAgent });

    await cache.isAllowed('http://example.com/page1');
    const allowed = await cache.isAllowed('http://example.com/page2');

    expect(allowed).toBe(true);
  });

  it('should fetch robots.txt separately for different domains', async () => {
    mockRobotsTxt('http://alpha.com', 'User-agent: *\nDisallow: /\n');
    mockRobotsTxt('http://beta.com', 'User-agent: *\nAllow: /\n');

    const cache = new RobotsCache({ userAgent: 'TestBot', dispatcher: mockAgent });

    expect(await cache.isAllowed('http://alpha.com/page')).toBe(false);
    expect(await cache.isAllowed('http://beta.com/page')).toBe(true);
  });

  it('should allow all URLs when robots.txt fetch fails with network error', async () => {
    const pool = mockAgent.get('http://example.com');
    pool.intercept({ path: '/robots.txt', method: 'GET' }).replyWithError(new Error('ECONNREFUSED'));

    const cache = new RobotsCache({ userAgent: 'TestBot', dispatcher: mockAgent });
    const allowed = await cache.isAllowed('http://example.com/anything');

    expect(allowed).toBe(true);
  });

  it('should allow all URLs when robots.txt returns non-200 status', async () => {
    mockRobotsTxt('http://example.com', 'Not Found', 404);

    const cache = new RobotsCache({ userAgent: 'TestBot', dispatcher: mockAgent });
    const allowed = await cache.isAllowed('http://example.com/anything');

    expect(allowed).toBe(true);
  });

  it('should clear cache when clear() is called', async () => {
    mockRobotsTxt('http://example.com', 'User-agent: *\nDisallow: /blocked/\n');

    const cache = new RobotsCache({ userAgent: 'TestBot', dispatcher: mockAgent });
    await cache.isAllowed('http://example.com/blocked/page');

    cache.clear();

    // After clearing, a new fetch should happen
    mockRobotsTxt('http://example.com', 'User-agent: *\nAllow: /\n');

    const allowed = await cache.isAllowed('http://example.com/blocked/page');
    expect(allowed).toBe(true);
  });

  it('should handle empty robots.txt (allow all)', async () => {
    mockRobotsTxt('http://example.com', '');

    const cache = new RobotsCache({ userAgent: 'TestBot', dispatcher: mockAgent });
    const allowed = await cache.isAllowed('http://example.com/anything');

    expect(allowed).toBe(true);
  });

  it('should handle Disallow with empty path (allow all)', async () => {
    mockRobotsTxt('http://example.com', 'User-agent: *\nDisallow:\n');

    const cache = new RobotsCache({ userAgent: 'TestBot', dispatcher: mockAgent });
    const allowed = await cache.isAllowed('http://example.com/anything');

    expect(allowed).toBe(true);
  });

  it('should handle wildcard patterns in Disallow', async () => {
    mockRobotsTxt('http://example.com', 'User-agent: *\nDisallow: /*.pdf$\n');

    const cache = new RobotsCache({ userAgent: 'TestBot', dispatcher: mockAgent });

    expect(await cache.isAllowed('http://example.com/doc.pdf')).toBe(false);
    expect(await cache.isAllowed('http://example.com/page.html')).toBe(true);
  });

  it('should deduplicate concurrent requests for the same domain', async () => {
    // Only one intercept — concurrent calls must share the same fetch
    mockRobotsTxt('http://example.com', 'User-agent: *\nDisallow: /secret/\n');

    const cache = new RobotsCache({ userAgent: 'TestBot', dispatcher: mockAgent });

    const [r1, r2, r3] = await Promise.all([
      cache.isAllowed('http://example.com/page1'),
      cache.isAllowed('http://example.com/page2'),
      cache.isAllowed('http://example.com/secret/page'),
    ]);

    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(r3).toBe(false);
  });
});
