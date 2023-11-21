const path = require('node:path');
const { once } = require('node:events');

const test = require('ava');

const delay = require('delay');
const Bree = require('../src');

const root = path.join(__dirname, 'jobs');

test('job does not exist', async (t) => {
  const bree = new Bree({
    root,
    jobs: ['basic']
  });

  const err = await t.throwsAsync(bree.run('leroy'));
  t.is(err.message, 'Job "leroy" does not exist');
});

test('job already running', async (t) => {
  const logger = {};
  logger.warn = (err, _) => {
    t.is(err.message, 'Job "basic" is already running');
  };

  logger.info = () => {};

  const bree = new Bree({
    root,
    jobs: ['basic'],
    logger
  });

  await bree.run('basic');
  await bree.run('basic');
});

test.serial('job terminates after closeWorkerAfterMs', async (t) => {
  t.plan(3);

  const logger = {};
  logger.info = () => {};
  logger.error = () => {};

  const bree = new Bree({
    root,
    jobs: [{ name: 'long', closeWorkerAfterMs: 2000 }],
    logger
  });

  await bree.run('long');
  await once(bree.workers.get('long'), 'online');
  t.true(bree.closeWorkerAfterMs.has('long'));

  const [code] = await once(bree.workers.get('long'), 'exit');
  t.is(code, 1);
  t.false(bree.closeWorkerAfterMs.has('long'));
});

test('job terminates before closeWorkerAfterMs', async (t) => {
  const logger = {};
  logger.info = () => {};
  logger.error = () => {};

  const bree = new Bree({
    root,
    jobs: [{ name: 'short', closeWorkerAfterMs: 2000 }],
    logger
  });

  await bree.run('short');
  await once(bree.workers.get('short'), 'online');
  t.true(bree.closeWorkerAfterMs.has('short'));

  const [code] = await once(bree.workers.get('short'), 'exit');
  t.is(code, 2);
  t.false(bree.closeWorkerAfterMs.has('short'));
});

test('job terminates should clear closeWorkerAfterMs', async (t) => {
  const logger = {};
  logger.info = () => {};
  logger.error = () => {};

  const bree = new Bree({
    root,
    jobs: [{ name: 'short', closeWorkerAfterMs: 2000 }],
    logger
  });

  await bree.run('short');
  await once(bree.workers.get('short'), 'online');
  t.true(bree.closeWorkerAfterMs.has('short'));

  const [code] = await once(bree.workers.get('short'), 'exit');
  t.is(code, 2);
  t.false(bree.closeWorkerAfterMs.has('short'));
});

test('job terminates on message "done"', async (t) => {
  const logger = {};
  logger.info = () => {};

  const bree = new Bree({
    root,
    jobs: [{ name: 'done' }],
    logger
  });

  await bree.run('done');

  await delay(10);

  t.true(bree.workers.has('done'));
  const [message] = await once(bree.workers.get('done'), 'message');
  t.is(message, 'get ready');

  await once(bree, 'worker deleted');
  await delay(10);
  t.false(bree.workers.has('done'));
});

test('job terminates on message "done" should clear closeWorkerAfterMs', async (t) => {
  const logger = {};
  logger.info = () => {};

  const bree = new Bree({
    root,
    jobs: [{ name: 'done', closeWorkerAfterMs: 2000 }],
    logger
  });

  await bree.run('done');

  await delay(10);

  t.true(bree.workers.has('done'));
  const [message] = await once(bree.workers.get('done'), 'message');
  t.is(message, 'get ready');
  t.true(bree.closeWorkerAfterMs.has('done'));

  await once(bree, 'worker deleted');
  await delay(10);
  t.false(bree.workers.has('done'));
  t.false(bree.closeWorkerAfterMs.has('done'));
});

test('job sent a message', async (t) => {
  const logger = {};
  logger.info = (message) => {
    if (message === 'Worker for job "message" sent a message') {
      t.pass();
    }
  };

  const bree = new Bree({
    root,
    jobs: [{ name: 'message' }],
    logger
  });

  await bree.run('message');

  bree.workers.get('message').postMessage('test');

  await once(bree.workers.get('message'), 'exit');
});

test('job sent an error', async (t) => {
  const logger = {
    error(message) {
      if (message === 'Worker for job "message" had an error') {
        t.pass();
      }
    },
    info() {}
  };

  const bree = new Bree({
    root,
    jobs: [{ name: 'message' }],
    logger
  });

  await bree.run('message');

  bree.workers.get('message').postMessage('error');

  await once(bree.workers.get('message'), 'error');
  await once(bree.workers.get('message'), 'exit');
});

test('job sent an error with custom handler', async (t) => {
  t.plan(5);
  const logger = {
    error() {},
    info() {}
  };

  const bree = new Bree({
    root,
    jobs: [{ name: 'message' }],
    logger,
    errorHandler(err, workerMeta) {
      t.true(workerMeta.name === 'message');

      if (workerMeta.err) {
        t.true(err.message === 'oops');
        t.true(workerMeta.err.name === 'Error');
      } else {
        t.true(err.message === 'Worker for job "message" exited with code 1');
      }
    }
  });

  await bree.run('message');

  bree.workers.get('message').postMessage('error');

  await once(bree.workers.get('message'), 'error');
  await once(bree.workers.get('message'), 'exit');
});

test('job sent a message with custom worker message handler', async (t) => {
  t.plan(3);

  const logger = {
    error() {},
    info() {}
  };

  const bree = new Bree({
    root,
    jobs: [{ name: 'message' }],
    logger,
    workerMessageHandler(metadata) {
      t.is(Object.keys(metadata).length, 2);
      t.is(metadata.message, 'hey Bob!');
      t.is(metadata.name, 'message');
    }
  });

  await bree.run('message');

  bree.workers.get('message').postMessage('hey Bob!');

  await once(bree.workers.get('message'), 'exit');
});

test('job sent a message with custom worker message handler and metadata', async (t) => {
  t.plan(4);

  const logger = {
    error() {},
    info() {}
  };

  const bree = new Bree({
    root,
    jobs: [{ name: 'message' }],
    logger,
    outputWorkerMetadata: true,
    workerMessageHandler(metadata) {
      t.is(Object.keys(metadata).length, 3);
      t.is(metadata.message, 'hi Alice!');
      t.is(metadata.name, 'message');
      t.is(Object.keys(metadata.worker).length, 3);
    }
  });

  await bree.run('message');

  bree.workers.get('message').postMessage('hi Alice!');

  await once(bree.workers.get('message'), 'exit');
});

test('jobs run all when no name designated', async (t) => {
  const logger = {};
  logger.info = () => {};

  const bree = new Bree({
    root,
    jobs: ['basic'],
    logger
  });

  await bree.run();
  await delay(10);

  t.true(bree.workers.has('basic'));

  const [code] = await once(bree.workers.get('basic'), 'exit');
  t.is(code, 0);

  t.false(bree.workers.has('basic'));
});

test('job runs with no worker options in config', async (t) => {
  const logger = {};
  logger.info = () => {};

  const bree = new Bree({
    root,
    jobs: ['basic'],
    logger,
    worker: false
  });

  await bree.run('basic');
  await delay(10);

  t.true(bree.workers.has('basic'));

  const [code] = await once(bree.workers.get('basic'), 'exit');
  t.is(code, 0);

  t.false(bree.workers.has('basic'));
});

test('job runs and passes workerData from config', async (t) => {
  t.plan(4);
  const logger = {
    info(...args) {
      if (!args[1] || !args[1].message) {
        return;
      }

      t.is(args[1].message.test, 'test');
    }
  };

  const bree = new Bree({
    root,
    jobs: ['worker-data'],
    logger,
    worker: {
      workerData: {
        test: 'test'
      }
    }
  });

  await bree.run('worker-data');

  await delay(10);
  t.true(bree.workers.has('worker-data'));

  const [code] = await once(bree.workers.get('worker-data'), 'exit');
  t.is(code, 0);

  t.false(bree.workers.has('worker-data'));
});
