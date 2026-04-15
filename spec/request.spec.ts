import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAgent } from 'undici';
import { makeRequest } from '../src/request.js';

describe('makeRequest', () => {
  let mockAgent: MockAgent;

  beforeEach(() => {
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
  });

  afterEach(async () => {
    await mockAgent.close();
  });

  it('should make a successful GET request', async () => {
    const pool = mockAgent.get('http://example.com');
    pool.intercept({ path: '/page', method: 'GET' }).reply(200, '<html>hello</html>', {
      headers: { 'content-type': 'text/html' },
    });

    const response = await makeRequest({
      url: 'http://example.com/page',
      referer: '',
      userAgent: 'test-agent',
      dispatcher: mockAgent,
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.toString()).toBe('<html>hello</html>');
    expect(response.url).toBe('http://example.com/page');
    expect(response.redirectUrls).toEqual([]);
    expect(response.headers['content-type']).toBe('text/html');
  });

  it('should send User-Agent and Referer headers', async () => {
    const pool = mockAgent.get('http://example.com');
    pool.intercept({
      path: '/page',
      method: 'GET',
      headers: {
        'User-Agent': 'my-crawler',
        Referer: 'http://example.com/',
      },
    }).reply(200, 'ok');

    const response = await makeRequest({
      url: 'http://example.com/page',
      referer: 'http://example.com/',
      userAgent: 'my-crawler',
      dispatcher: mockAgent,
    });

    expect(response.statusCode).toBe(200);
  });

  it('should merge custom headers with defaults', async () => {
    const pool = mockAgent.get('http://example.com');
    pool.intercept({
      path: '/page',
      method: 'GET',
      headers: {
        'User-Agent': 'my-crawler',
        'X-Custom': 'value',
      },
    }).reply(200, 'ok');

    const response = await makeRequest({
      url: 'http://example.com/page',
      referer: '',
      userAgent: 'my-crawler',
      headers: { 'X-Custom': 'value' },
      dispatcher: mockAgent,
    });

    expect(response.statusCode).toBe(200);
  });

  it('should allow custom headers to override defaults', async () => {
    const pool = mockAgent.get('http://example.com');
    pool.intercept({
      path: '/page',
      method: 'GET',
      headers: {
        'User-Agent': 'custom-agent',
      },
    }).reply(200, 'ok');

    const response = await makeRequest({
      url: 'http://example.com/page',
      referer: '',
      userAgent: 'default-agent',
      headers: { 'User-Agent': 'custom-agent' },
      dispatcher: mockAgent,
    });

    expect(response.statusCode).toBe(200);
  });

  it('should follow redirects and track redirect chain', async () => {
    const pool = mockAgent.get('http://example.com');
    pool.intercept({ path: '/a', method: 'GET' }).reply(301, '', {
      headers: { location: '/b' },
    });
    pool.intercept({ path: '/b', method: 'GET' }).reply(302, '', {
      headers: { location: '/c' },
    });
    pool.intercept({ path: '/c', method: 'GET' }).reply(200, 'final');

    const response = await makeRequest({
      url: 'http://example.com/a',
      referer: '',
      userAgent: 'test-agent',
      dispatcher: mockAgent,
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.toString()).toBe('final');
    expect(response.url).toBe('http://example.com/c');
    expect(response.redirectUrls).toEqual([
      'http://example.com/a',
      'http://example.com/b',
    ]);
  });

  it('should handle redirect with absolute URL in Location', async () => {
    const pool = mockAgent.get('http://example.com');
    pool.intercept({ path: '/old', method: 'GET' }).reply(301, '', {
      headers: { location: 'http://example.com/new' },
    });
    pool.intercept({ path: '/new', method: 'GET' }).reply(200, 'moved');

    const response = await makeRequest({
      url: 'http://example.com/old',
      referer: '',
      userAgent: 'test-agent',
      dispatcher: mockAgent,
    });

    expect(response.url).toBe('http://example.com/new');
    expect(response.redirectUrls).toEqual(['http://example.com/old']);
  });

  it('should handle redirect with no Location header', async () => {
    const pool = mockAgent.get('http://example.com');
    pool.intercept({ path: '/redir', method: 'GET' }).reply(301, '');

    const response = await makeRequest({
      url: 'http://example.com/redir',
      referer: '',
      userAgent: 'test-agent',
      dispatcher: mockAgent,
    });

    expect(response.statusCode).toBe(301);
    expect(response.url).toBe('http://example.com/redir');
    expect(response.redirectUrls).toEqual([]);
  });

  it('should throw on too many redirects', async () => {
    const pool = mockAgent.get('http://example.com');
    for (let i = 0; i <= 10; i++) {
      pool.intercept({ path: `/r${i}`, method: 'GET' }).reply(302, '', {
        headers: { location: `/r${i + 1}` },
      });
    }

    await expect(
      makeRequest({
        url: 'http://example.com/r0',
        referer: '',
        userAgent: 'test-agent',
        dispatcher: mockAgent,
      }),
    ).rejects.toThrow('Too many redirects');
  });

  it('should return non-200 responses without throwing', async () => {
    const pool = mockAgent.get('http://example.com');
    pool.intercept({ path: '/missing', method: 'GET' }).reply(404, 'not found');

    const response = await makeRequest({
      url: 'http://example.com/missing',
      referer: '',
      userAgent: 'test-agent',
      dispatcher: mockAgent,
    });

    expect(response.statusCode).toBe(404);
    expect(response.body.toString()).toBe('not found');
  });

  it('should retry on network errors', async () => {
    const pool = mockAgent.get('http://example.com');

    pool.intercept({ path: '/flaky', method: 'GET' }).replyWithError(new Error('ECONNRESET'));
    pool.intercept({ path: '/flaky', method: 'GET' }).replyWithError(new Error('ECONNRESET'));
    pool.intercept({ path: '/flaky', method: 'GET' }).reply(200, 'recovered');

    const response = await makeRequest({
      url: 'http://example.com/flaky',
      referer: '',
      userAgent: 'test-agent',
      maxRetries: 2,
      retryDelay: 10,
      dispatcher: mockAgent,
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.toString()).toBe('recovered');
  });

  it('should throw after exhausting retries', async () => {
    const pool = mockAgent.get('http://example.com');

    pool.intercept({ path: '/down', method: 'GET' }).replyWithError(new Error('ECONNREFUSED'));
    pool.intercept({ path: '/down', method: 'GET' }).replyWithError(new Error('ECONNREFUSED'));
    pool.intercept({ path: '/down', method: 'GET' }).replyWithError(new Error('ECONNREFUSED'));

    await expect(
      makeRequest({
        url: 'http://example.com/down',
        referer: '',
        userAgent: 'test-agent',
        maxRetries: 2,
        retryDelay: 10,
        dispatcher: mockAgent,
      }),
    ).rejects.toThrow('ECONNREFUSED');
  });

  it('should abort when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      makeRequest({
        url: 'http://example.com/page',
        referer: '',
        userAgent: 'test-agent',
        signal: controller.signal,
        dispatcher: mockAgent,
      }),
    ).rejects.toThrow(/abort/i);
  });

  it('should not retry on abort', async () => {
    const controller = new AbortController();
    const pool = mockAgent.get('http://example.com');

    pool.intercept({ path: '/slow', method: 'GET' }).reply(200, 'data').delay(5000);

    const requestPromise = makeRequest({
      url: 'http://example.com/slow',
      referer: '',
      userAgent: 'test-agent',
      requestTimeout: 60000,
      maxRetries: 3,
      retryDelay: 10,
      signal: controller.signal,
      dispatcher: mockAgent,
    });

    setTimeout(() => controller.abort(), 50);

    await expect(requestPromise).rejects.toThrow(/abort/i);
  });

  it('should return binary body as Buffer', async () => {
    const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const pool = mockAgent.get('http://example.com');
    pool.intercept({ path: '/image.png', method: 'GET' }).reply(200, binaryData, {
      headers: { 'content-type': 'image/png' },
    });

    const response = await makeRequest({
      url: 'http://example.com/image.png',
      referer: '',
      userAgent: 'test-agent',
      dispatcher: mockAgent,
    });

    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect(response.body.length).toBe(binaryData.length);
  });

  it('should handle 307 redirect', async () => {
    const pool = mockAgent.get('http://example.com');
    pool.intercept({ path: '/temp', method: 'GET' }).reply(307, '', {
      headers: { location: '/target' },
    });
    pool.intercept({ path: '/target', method: 'GET' }).reply(200, 'redirected');

    const response = await makeRequest({
      url: 'http://example.com/temp',
      referer: '',
      userAgent: 'test-agent',
      dispatcher: mockAgent,
    });

    expect(response.statusCode).toBe(200);
    expect(response.url).toBe('http://example.com/target');
    expect(response.redirectUrls).toEqual(['http://example.com/temp']);
  });

  it('should use default options when not specified', async () => {
    const pool = mockAgent.get('http://example.com');
    pool.intercept({ path: '/', method: 'GET' }).reply(200, 'ok');

    const response = await makeRequest({
      url: 'http://example.com/',
      referer: '',
      userAgent: 'test',
      dispatcher: mockAgent,
    });

    expect(response.statusCode).toBe(200);
  });
});
