/*
 * Rate-limited concurrent task executor with event-driven scheduling.
 * Uses a token bucket algorithm for rate limiting.
 */

export type ExecutableTask = () => Promise<void>;

export interface ExecutorOptions {
  maxRatePerSecond: number;
  maxConcurrentTasks: number;
}

export default class Executor {
  private readonly maxRatePerSecond: number;
  private readonly maxConcurrentTasks: number;
  private readonly queue: Array<{ task: ExecutableTask; resolve: () => void; reject: (err: Error) => void }> = [];
  private activeTasks = 0;
  private tokens: number;
  private lastRefill: number;
  private refillInterval: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private drainResolvers: Array<() => void> = [];

  constructor({ maxRatePerSecond, maxConcurrentTasks }: ExecutorOptions) {
    this.maxRatePerSecond = maxRatePerSecond;
    this.maxConcurrentTasks = maxConcurrentTasks || Number.MAX_VALUE;
    this.tokens = maxRatePerSecond;
    this.lastRefill = Date.now();
  }

  start(): void {
    this.stopped = false;
    this.lastRefill = Date.now();
    this.refillInterval = setInterval(() => this.refillTokens(), 100);
    this.flush();
  }

  submit(task: ExecutableTask): Promise<void> {
    if (this.stopped) {
      return Promise.reject(new Error('Executor is stopped'));
    }
    return new Promise<void>((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.flush();
    });
  }

  stop(): void {
    this.stopped = true;
    if (this.refillInterval !== null) {
      clearInterval(this.refillInterval);
      this.refillInterval = null;
    }
    // Reject all queued (not yet running) tasks
    const pending = this.queue.splice(0);
    const err = new Error('Executor stopped');
    for (const item of pending) {
      item.reject(err);
    }
    // If nothing active, resolve drain waiters
    if (this.activeTasks === 0) {
      this.resolveDrainWaiters();
    }
  }

  drain(): Promise<void> {
    if (this.queue.length === 0 && this.activeTasks === 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.drainResolvers.push(resolve);
    });
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get activeCount(): number {
    return this.activeTasks;
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = (elapsed / 1000) * this.maxRatePerSecond;
    this.tokens = Math.min(this.maxRatePerSecond, this.tokens + newTokens);
    this.lastRefill = now;
    this.flush();
  }

  private flush(): void {
    while (
      this.queue.length > 0 &&
      !this.stopped &&
      this.activeTasks < this.maxConcurrentTasks &&
      this.tokens >= 1
    ) {
      const item = this.queue.shift()!;
      this.tokens -= 1;
      this.activeTasks++;
      this.runTask(item);
    }
  }

  private runTask(item: { task: ExecutableTask; resolve: () => void; reject: (err: Error) => void }): void {
    item.task().then(
      () => {
        item.resolve();
        this.onTaskComplete();
      },
      (err: Error) => {
        item.resolve(); // Resolve the submit promise even on task failure — the task itself handles errors
        this.onTaskComplete();
      },
    );
  }

  private onTaskComplete(): void {
    this.activeTasks--;
    if (!this.stopped) {
      this.flush();
    }
    if (this.queue.length === 0 && this.activeTasks === 0) {
      this.resolveDrainWaiters();
    }
  }

  private resolveDrainWaiters(): void {
    const waiters = this.drainResolvers.splice(0);
    for (const resolve of waiters) {
      resolve();
    }
  }
}
