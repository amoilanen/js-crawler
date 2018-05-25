import * as sinon from 'sinon';
import { Executor, ExecutableTask } from '../../src/executor';

export const waitForCondition = (condition: () => boolean, options = { checkTimeoutMilliseconds: 10, maxTimeWaitedMilliseconds: 1000 }): Promise<void> => {
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

export const waitForSomeTime = (timeoutMilliseconds: number = 100) => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, timeoutMilliseconds);
  });
}

export const textResponse = (url: string, statusCode: number, body: string) =>
  ({
    headers: {
      'content-type': 'text/html'
    },
    body: {
      toString(encoding: string) {
        return body;
      }
    },
    statusCode: statusCode,
    request: {
      uri: {
        href: url
      }
    }
  });

export const immediateExecutor: Executor = {
  start: () => {},
  submit: (task: ExecutableTask) => {
    task();
  },
  stop: () => {}
};

export const interceptAfter = (obj, method, interceptorMethod) => {
  const originalMethod = obj[method];
  const fakeMethod = sinon.stub();
  obj[method] = fakeMethod;
  fakeMethod.callsFake((...args) => {
    originalMethod.apply(obj, args);
    interceptorMethod.apply(null, args);
  });
};