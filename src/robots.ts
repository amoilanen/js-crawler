import robotsParser from 'robots-parser';
import { request as undiciRequest, type Dispatcher } from 'undici';

export interface RobotsCacheOptions {
  userAgent: string;
  dispatcher?: Dispatcher;
}

export class RobotsCache {
  private cache = new Map<string, ReturnType<typeof robotsParser>>();
  private pending = new Map<string, Promise<ReturnType<typeof robotsParser> | null>>();
  private userAgent: string;
  private dispatcher?: Dispatcher;

  constructor(options: RobotsCacheOptions) {
    this.userAgent = options.userAgent;
    this.dispatcher = options.dispatcher;
  }

  async isAllowed(url: string): Promise<boolean> {
    const origin = new URL(url).origin;
    const robot = await this.getRobots(origin);
    if (!robot) return true;
    return robot.isAllowed(url, this.userAgent) ?? true;
  }

  clear(): void {
    this.cache.clear();
    this.pending.clear();
  }

  private async getRobots(origin: string): Promise<ReturnType<typeof robotsParser> | null> {
    if (this.cache.has(origin)) {
      return this.cache.get(origin)!;
    }

    if (this.pending.has(origin)) {
      return this.pending.get(origin)!;
    }

    const promise = this.fetchRobots(origin);
    this.pending.set(origin, promise);

    try {
      const robot = await promise;
      if (robot) {
        this.cache.set(origin, robot);
      }
      return robot;
    } finally {
      this.pending.delete(origin);
    }
  }

  private async fetchRobots(origin: string): Promise<ReturnType<typeof robotsParser> | null> {
    const robotsUrl = `${origin}/robots.txt`;
    try {
      const response = await undiciRequest(robotsUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': this.userAgent },
        ...(this.dispatcher ? { dispatcher: this.dispatcher } : {}),
      });

      if (response.statusCode !== 200) {
        await response.body.text();
        return null;
      }

      const body = await response.body.text();
      return robotsParser(robotsUrl, body);
    } catch {
      return null;
    }
  }
}
