const path = require('path');

const test = require('ava');

const delay = require('delay');
const Bree = require('../src');

const root = path.join(__dirname, 'jobs');

const baseConfig = {
  root,
  timeout: 0,
  interval: 0,
  hasSeconds: false,
  defaultExtension: 'js'
};

test('throws if no job exists', async (t) => {
  const bree = new Bree({
    jobs: ['basic'],
    ...baseConfig
  });

  await bree.init();

  t.throws(() => bree.getWorkerMetadata('test'), {
    message: 'Job "test" does not exist'
  });
});

test('returns undefined if output not set to true', async (t) => {
  const bree = new Bree({
    jobs: ['basic'],
    ...baseConfig
  });

  await bree.init();

  const meta = { test: 1 };

  t.is(typeof bree.getWorkerMetadata('basic', meta), 'undefined');
});

test('returns meta if error', async (t) => {
  const bree = new Bree({
    jobs: ['basic'],
    ...baseConfig
  });

  await bree.init();

  const meta = { err: true, message: true };

  t.is(bree.getWorkerMetadata('basic', meta), meta);
});

test('returns meta if output set to true', async (t) => {
  const bree = new Bree({
    jobs: ['basic'],
    ...baseConfig,
    outputWorkerMetadata: true
  });

  await bree.init();

  const meta = { test: 1 };

  t.is(bree.getWorkerMetadata('basic', meta), meta);
});

test('returns meta and worker data if running', async (t) => {
  const logger = {
    info() {}
  };

  const bree = new Bree({
    jobs: ['infinite'],
    ...baseConfig,
    outputWorkerMetadata: true,
    logger
  });

  await bree.start();
  await delay(10);

  const meta = { test: 1 };

  t.is(typeof bree.getWorkerMetadata('infinite', meta).worker, 'object');

  await bree.stop();
});

test('job with worker data sent by job', async (t) => {
  t.plan(1);

  const logger = {
    info(...args) {
      if (!args[1] || !args[1].message) {
        return;
      }

      t.is(args[1].message.test, 'test');
    },
    error() {}
  };

  const bree = new Bree({
    root,
    jobs: [{ name: 'worker-data', worker: { workerData: { test: 'test' } } }],
    outputWorkerMetadata: true,
    logger
  });

  await bree.run('worker-data');
  await delay(1000);

  await bree.stop();
});
