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

test('throws if no job exists', (t) => {
  const bree = new Bree({
    jobs: ['basic'],
    ...baseConfig
  });

  t.throws(() => bree.getWorkerMetadata('test'), {
    message: 'Job "test" does not exist'
  });
});

test('returns undefined if output not set to true', (t) => {
  const bree = new Bree({
    jobs: ['basic'],
    ...baseConfig
  });

  const meta = { test: 1 };

  t.is(typeof bree.getWorkerMetadata('basic', meta), 'undefined');
});

test('returns meta if error', (t) => {
  const bree = new Bree({
    jobs: ['basic'],
    ...baseConfig
  });

  const meta = { err: true, message: true };

  t.is(bree.getWorkerMetadata('basic', meta), meta);
});

test('returns meta if output set to true', (t) => {
  const bree = new Bree({
    jobs: ['basic'],
    ...baseConfig,
    outputWorkerMetadata: true
  });

  const meta = { test: 1 };

  t.is(bree.getWorkerMetadata('basic', meta), meta);
});

test('returns meta and worker data if running', async (t) => {
  const logger = {
    info: () => {}
  };

  const bree = new Bree({
    jobs: ['infinite'],
    ...baseConfig,
    outputWorkerMetadata: true,
    logger
  });

  bree.start();
  await delay(1);

  const meta = { test: 1 };

  t.is(typeof bree.getWorkerMetadata('infinite', meta).worker, 'object');

  await bree.stop();
});

test('job with worker data sent by job', async (t) => {
  t.plan(1);

  const logger = {
    info: (...args) => {
      if (!args[1] || !args[1].message) {
        return;
      }

      t.is(args[1].message.test, 'test');
    },
    error: () => {}
  };

  const bree = new Bree({
    root,
    jobs: [{ name: 'worker-data', worker: { workerData: { test: 'test' } } }],
    outputWorkerMetadata: true,
    logger
  });

  bree.run('worker-data');
  await delay(1000);

  await bree.stop();
});

test('job with worker data modified by "before worker created" event (sync only)', async (t) => {
  t.plan(1);
  
  const logger = {
    info: (...args) => {
      if (!args[1] || !args[1].message) {
        return;
      }

      t.is(args[1].message.meta, 'test1');
    },
    error: () => {}
  };

  const bree = new Bree({
    root,
    jobs: [{ name: 'worker-data', worker: { workerData: { meta: 'test' } } }],
    outputWorkerMetadata: true,
    logger
  });

  bree.on('before worker created', (name) => {
    const job = bree.config.jobs.find((j) => j.name === name);
    job.worker.workerData.meta = 'test1';
  });

  bree.run('worker-data');
  await delay(1000);

  await bree.stop();
});
