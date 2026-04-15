import { describe, it, expect, afterEach } from 'vitest';
import Executor from '../src/executor.js';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Executor', () => {
  let executor: Executor;

  afterEach(() => {
    executor?.stop();
  });

  describe('basic task execution', () => {
    it('should execute a submitted task', async () => {
      executor = new Executor({ maxRatePerSecond: 100, maxConcurrentTasks: 10 });
      executor.start();

      let executed = false;
      await executor.submit(async () => { executed = true; });
      expect(executed).toBe(true);
    });

    it('should execute multiple tasks in order', async () => {
      executor = new Executor({ maxRatePerSecond: 100, maxConcurrentTasks: 1 });
      executor.start();

      const order: number[] = [];
      const p1 = executor.submit(async () => { order.push(1); });
      const p2 = executor.submit(async () => { order.push(2); });
      const p3 = executor.submit(async () => { order.push(3); });
      await Promise.all([p1, p2, p3]);
      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('concurrency limiting', () => {
    it('should not exceed maxConcurrentTasks', async () => {
      executor = new Executor({ maxRatePerSecond: 100, maxConcurrentTasks: 2 });
      executor.start();

      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const makeTask = () => async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await delay(50);
        currentConcurrent--;
      };

      const promises = Array.from({ length: 6 }, () => executor.submit(makeTask()));
      await Promise.all(promises);

      expect(maxConcurrent).toBeLessThanOrEqual(2);
      expect(maxConcurrent).toBeGreaterThanOrEqual(1);
    });

    it('should run tasks concurrently up to the limit', async () => {
      executor = new Executor({ maxRatePerSecond: 100, maxConcurrentTasks: 3 });
      executor.start();

      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const makeTask = () => async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await delay(50);
        currentConcurrent--;
      };

      const promises = Array.from({ length: 6 }, () => executor.submit(makeTask()));
      await Promise.all(promises);

      expect(maxConcurrent).toBe(3);
    });
  });

  describe('rate limiting', () => {
    it('should not exceed maxRatePerSecond', async () => {
      const rate = 10;
      executor = new Executor({ maxRatePerSecond: rate, maxConcurrentTasks: 100 });
      executor.start();

      const timestamps: number[] = [];
      const taskCount = 20;

      const promises: Promise<void>[] = [];
      for (let i = 0; i < taskCount; i++) {
        promises.push(executor.submit(async () => {
          timestamps.push(Date.now());
        }));
      }
      await Promise.all(promises);

      expect(timestamps).toHaveLength(taskCount);

      // With 20 tasks at 10/sec, first 10 use initial tokens, next 10 need ~1 second
      const totalDuration = timestamps[timestamps.length - 1] - timestamps[0];
      expect(totalDuration).toBeGreaterThanOrEqual(800);
    });
  });

  describe('stop behavior', () => {
    it('should reject queued tasks on stop', async () => {
      executor = new Executor({ maxRatePerSecond: 1, maxConcurrentTasks: 1 });
      executor.start();

      // Fill the initial token with a slow task
      const slowPromise = executor.submit(() => delay(500));

      // These will be queued
      const p1 = executor.submit(async () => {});
      const p2 = executor.submit(async () => {});

      executor.stop();

      await expect(p1).rejects.toThrow('Executor stopped');
      await expect(p2).rejects.toThrow('Executor stopped');
    });

    it('should reject submit after stop', async () => {
      executor = new Executor({ maxRatePerSecond: 100, maxConcurrentTasks: 10 });
      executor.start();
      executor.stop();

      await expect(executor.submit(async () => {})).rejects.toThrow('Executor is stopped');
    });

    it('should not execute new tasks after stop', async () => {
      executor = new Executor({ maxRatePerSecond: 1, maxConcurrentTasks: 1 });
      executor.start();

      let taskRan = false;
      executor.submit(() => delay(200));
      const p = executor.submit(async () => { taskRan = true; });

      executor.stop();

      await expect(p).rejects.toThrow('Executor stopped');
      expect(taskRan).toBe(false);
    });
  });

  describe('drain', () => {
    it('should resolve immediately when no tasks', async () => {
      executor = new Executor({ maxRatePerSecond: 100, maxConcurrentTasks: 10 });
      executor.start();

      await executor.drain();
    });

    it('should resolve when all tasks complete', async () => {
      executor = new Executor({ maxRatePerSecond: 100, maxConcurrentTasks: 10 });
      executor.start();

      const results: number[] = [];
      executor.submit(async () => { await delay(20); results.push(1); });
      executor.submit(async () => { await delay(40); results.push(2); });
      executor.submit(async () => { await delay(10); results.push(3); });

      await executor.drain();

      expect(results).toHaveLength(3);
      expect(results).toContain(1);
      expect(results).toContain(2);
      expect(results).toContain(3);
    });

    it('should resolve when tasks with errors complete', async () => {
      executor = new Executor({ maxRatePerSecond: 100, maxConcurrentTasks: 10 });
      executor.start();

      executor.submit(async () => { throw new Error('task error'); });
      executor.submit(async () => { await delay(10); });

      await executor.drain();
    });
  });

  describe('edge cases', () => {
    it('should handle tasks that throw errors', async () => {
      executor = new Executor({ maxRatePerSecond: 100, maxConcurrentTasks: 10 });
      executor.start();

      await executor.submit(async () => { throw new Error('oops'); });
    });

    it('should track active and pending counts', async () => {
      executor = new Executor({ maxRatePerSecond: 100, maxConcurrentTasks: 1 });
      executor.start();

      let resolveFirst!: () => void;
      const firstBlocker = new Promise<void>((r) => { resolveFirst = r; });

      executor.submit(() => firstBlocker);
      executor.submit(async () => {});

      await delay(10);
      expect(executor.activeCount).toBe(1);
      expect(executor.pendingCount).toBe(1);

      resolveFirst();
      await executor.drain();

      expect(executor.activeCount).toBe(0);
      expect(executor.pendingCount).toBe(0);
    });

    it('should work with maxConcurrentTasks defaulting to unlimited', async () => {
      executor = new Executor({ maxRatePerSecond: 1000, maxConcurrentTasks: 0 });
      executor.start();

      let maxConcurrent = 0;
      let current = 0;

      const promises = Array.from({ length: 5 }, () =>
        executor.submit(async () => {
          current++;
          maxConcurrent = Math.max(maxConcurrent, current);
          await delay(10);
          current--;
        })
      );
      await Promise.all(promises);

      expect(maxConcurrent).toBe(5);
    });
  });
});
