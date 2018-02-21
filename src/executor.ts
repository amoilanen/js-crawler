/*
 * Executor that handles throttling and task processing rate.
 */

export interface WorkQueueItem {
  func: Function;
  context: any;
  args: Array<any>;
  shouldSkip: () => boolean;
}

export default class Executor {
  maxRatePerSecond: number;
  canProceed: () => boolean;
  queue: Array<WorkQueueItem>;
  isStopped: boolean;
  timeoutMs: number;

  constructor(options: any) {
    this.maxRatePerSecond = options.maxRatePerSecond;
    this.canProceed = options.canProceed || function() {return true;};
    this.queue = [];
    this.isStopped = false;
    this.timeoutMs = (1 / this.maxRatePerSecond) * 1000;
  }

  submit(func: Function, context: any, args: Array<any>, shouldSkip: () => boolean) {
    this.queue.push({
      func: func,
      context: context,
      args: args,
      shouldSkip: shouldSkip
    });
  }

  start() {
    this._processQueueItem();
  }

  stop() {
    this.isStopped = true;
  }

  _processQueueItem() {
    if (this.canProceed()) {
      if (this.queue.length !== 0) {
        var nextExecution = this.queue.shift();
        var shouldSkipNext = (nextExecution.shouldSkip && nextExecution.shouldSkip.call(nextExecution.context));
  
        if (shouldSkipNext) {
          setTimeout(() => {
            this._processQueueItem();
          }, 0);
          return;
        } else {
          nextExecution.func.apply(nextExecution.context, nextExecution.args);
        }
      }
    }
    if (this.isStopped) {
      return;
    }
    setTimeout(() => {
      this._processQueueItem();
    }, this.timeoutMs);
  }
}