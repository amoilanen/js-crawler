import AsynchronousExecutor from '../src/executor';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { waitForCondition, waitForSomeTime } from './util/util';

describe('executor', () => {

  const executorOptions = {
    maxRatePerSecond: 5,
    maxConcurrentTasks: 10
  };
  const values = [1, 2, 3, 4];
  let producedValues: Array<number>;
  let executor;

  beforeEach(() => {
    executor = new AsynchronousExecutor(executorOptions);
    producedValues = [];
  });

  function getSubmittedTaskHandles(task: (value: number) => void): Array<() => void> {
    let promiseResolves = [];
    values.forEach(value => {
      const promise = new Promise((resolve, reject) => {
        promiseResolves.push(resolve);
      });
      executor.submit(() => {
        task(value);
        return promise;
      });
    });
    return promiseResolves;
  }

  function submitTasks(task: (value: number) => void): void {
    const resolves = getSubmittedTaskHandles(task);
    resolves.forEach(resolve => resolve());
  }

  describe('task execution', () => {

    it('should execute submitted tasks', (done) => {
      submitTasks(value => {
        producedValues.push(value);
      });
      executor.start();

      waitForCondition(() => executor.queue.length == 0).then(() => {
        expect(producedValues).to.eql(values);
        executor.stop();
        done();
      });
    });

    it('should stop executing new tasks when maxConcurrentTasks has been reached', (done) => {
      executor = new AsynchronousExecutor(Object.assign(executorOptions, { maxConcurrentTasks: 2}));
      const taskResolves = getSubmittedTaskHandles(value => {
        producedValues.push(value);
      });
      executor.start();

      waitForCondition(() => executor.queue.length == 2).then(() => {
        expect(producedValues).to.eql(values.slice(0, 2));
        taskResolves.forEach(resolve => resolve());
        return waitForCondition(() => executor.queue.length == 0);
      }).then(() => {
        expect(producedValues).to.eql(values);
        done();
      });
    });

    it('should stop executing tasks when stopped', (done) => {
      submitTasks(value => {
        producedValues.push(value);
      });
      executor.stop();
      executor.processQueueItem();
      waitForSomeTime().then(() => {
        expect(executor.queue.length).to.eql(values.length);
        done();
      });
    });

    it('continuously executes tasks until explicitly stopped', (done) => {
      submitTasks(value => {
        producedValues.push(value);
        executor.stop();
      });

      executor.start();
      waitForSomeTime().then(() => {
        expect(executor.queue.length).to.eql(values.length - 1);
        expect(producedValues).to.eql(values.slice(0, 1));
        done();
      });
    });
  });
});
