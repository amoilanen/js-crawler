import Executor from '../src/executor';
import * as sinon from 'sinon';
import { expect } from 'chai';

describe('executor', () => {

  const executorOptions = {
    maxRatePerSecond: 5,
    maxConcurrentTasks: 10
  };
  let executor;

  beforeEach(() => {
    executor = new Executor(executorOptions);
  });

  function waitForCondition(condition: () => boolean, options = { checkTimeoutMilliseconds: 10, maxTimeWaitedMilliseconds: 1000 }): Promise<void> {
    const startTime = new Date().getTime();
    return new Promise((resolve, reject) => {
      setTimeout(function check() {
        if (condition()) {
          resolve();
        } else {
          const currentTime = new Date().getTime();
          const elapsedTime = currentTime - startTime;
          if (elapsedTime > options.maxTimeWaitedMilliseconds) {
            reject(`Timeout waiting for condition ${condition.toString()}`);
          } else {
            setTimeout(check, options.checkTimeoutMilliseconds)
          }
        }
      }, options.checkTimeoutMilliseconds);
    });
  }

  describe('task execution', () => {

    it('should execute submitted tasks', (done) => {
      let producedValues: Array<number> = [];
      let values = [1, 2, 3, 4, 5];
      values.forEach(value => {
        executor.submit(() => {
          producedValues.push(value);
          return Promise.resolve();
        });
      });
      executor.start();

      waitForCondition(() => executor.queue.length == 0).then(() => {
        expect(producedValues).to.eql(values);
        executor.stop();
        done();
      });
    });

    it('should stop executing new tasks when maxConcurrentTasks has been reached', (done) => {
      executor = new Executor(Object.assign(executorOptions, { maxConcurrentTasks: 2}));
      let values = Array.from({ length: 4 }, (x, i) => i);
      let producedValues = [];
      let promiseResolves = [];
      values.forEach(value => {
        const promise = new Promise((resolve, reject) => {
          promiseResolves.push(resolve);
        });
        executor.submit(() => {
          producedValues.push(value);
          return promise;
        });
      });
      executor.start();

      waitForCondition(() => executor.queue.length == 2).then(() => {
        expect(producedValues).to.eql([0, 1]);
        promiseResolves.forEach(resolve => resolve());
        return waitForCondition(() => executor.queue.length == 0);
      }).then(() => {
        expect(producedValues).to.eql([0, 1, 2, 3]);
        done();
      });
    });

    it('should stop executing tasks when stopped', () => {
      
    });

    it('continuously executes tasks until explicitly stopped', () => {

    });
  });
});
