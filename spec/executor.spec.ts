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

  describe('task execution', () => {

    it('should execute submitted tasks', (done) => {
      let producedValues: Array<number> = [];
      let values = [1, 2, 3, 4, 5];
      values.forEach((value, idx) => {
        executor.submit(() => {
          producedValues.push(values[idx]);
          return Promise.resolve();
        });
      });
      executor.start();

      setTimeout(function waitForEmptyQueue() {
        const isQueueEmpty = executor.queue.length == 0;
        if (isQueueEmpty) {
          expect(producedValues).to.eql(values);
          executor.stop();
          done();
        } else {
          setTimeout(waitForEmptyQueue, 10)
        }
      }, 10);
    });
  });
});
