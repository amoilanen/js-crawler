/*
 * Executor that handles throttling and task processing rate.
 */

export default class Executor {
  maxRatePerSecond: number;
  canProceed: () => boolean;
  queue: Array<Function>;
  isStopped: boolean;
  timeoutMs: number;

  constructor(options: any) {
    this.maxRatePerSecond = options.maxRatePerSecond;
    this.canProceed = options.canProceed || function() {return true;};
    this.queue = [];
    this.isStopped = false;
    this.timeoutMs = (1 / this.maxRatePerSecond) * 1000;
  }

  submit(func: Function) {
    this.queue.push(func);
  }

  start() {
    this.processQueueItem();
  }

  stop() {
    this.isStopped = true;
  }

  processQueueItem() {
    if (this.canProceed()) {
      if (this.queue.length !== 0) {
        const nextExecution = this.queue.shift();
        nextExecution();
      }
    }
    if (this.isStopped) {
      return;
    }
    setTimeout(() => {
      this.processQueueItem();
    }, this.timeoutMs);
  }
}