const path = require('path');
const { once } = require('events');

const test = require('ava');

const Bree = require('../src');
const delay = require('delay');

const root = path.join(__dirname, 'jobs');

test('job does not exist', (t) => {
  const bree = new Bree({
    root,
    jobs: ['basic']
  });

  t.throws(() => bree.run('leroy'), {
    message: 'Job "leroy" does not exist'
  });
});

test('job already running', (t) => {
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

  bree.run('basic');
  bree.run('basic');
});

test.serial('job terminates after closeWorkerAfterMs', async (t) => {
  t.plan(2);

  const logger = {};
  logger.info = () => {};
  logger.error = () => {};

  const bree = new Bree({
    root,
    jobs: [{ name: 'long', closeWorkerAfterMs: 2000 }],
    logger
  });

  bree.run('long');
  await once(bree.workers.long, 'online');
  t.true(typeof bree.closeWorkerAfterMs.long === 'object');

  const [code] = await once(bree.workers.long, 'exit');
  t.is(code, 1);
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

  bree.run('short');
  await once(bree.workers.short, 'online');
  t.true(typeof bree.closeWorkerAfterMs.short === 'object');

  const [code] = await once(bree.workers.short, 'exit');
  t.is(code, 2);
});

test('job terminates on message "done"', async (t) => {
  const logger = {};
  logger.info = () => {};

  const bree = new Bree({
    root,
    jobs: [{ name: 'done' }],
    logger
  });

  bree.run('done');

  await delay(1);

  t.is(typeof bree.workers.done, 'object');
  const [message] = await once(bree.workers.done, 'message');
  t.is(message, 'get ready');

  await delay(100);
  t.is(typeof bree.workers.done, 'undefined');
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

  bree.run('message');

  bree.workers.message.postMessage('test');

  await once(bree.workers.message, 'exit');
});

test('job sent an error', async (t) => {
  const logger = {
    error: (message) => {
      if (message === 'Worker for job "message" had an error') {
        t.pass();
      }
    },
    info: () => {}
  };

  const bree = new Bree({
    root,
    jobs: [{ name: 'message' }],
    logger
  });

  bree.run('message');

  bree.workers.message.postMessage('error');

  await once(bree.workers.message, 'error');
  await once(bree.workers.message, 'exit');
});

test('job sent an error with custom handler', async (t) => {
  t.plan(5);
  const logger = {
    error: () => {},
    info: () => {}
  };

  const bree = new Bree({
    root,
    jobs: [{ name: 'message' }],
    logger,
    errorHandler: (err, workerMeta) => {
      t.true(workerMeta.name === 'message');

      if (workerMeta.err) {
        t.true(err.message === 'oops');
        t.true(workerMeta.err.name === 'Error');
      } else {
        t.true(err.message === 'Worker for job "message" exited with code 1');
      }
    }
  });

  bree.run('message');

  bree.workers.message.postMessage('error');

  await once(bree.workers.message, 'error');
  await once(bree.workers.message, 'exit');
});

test('job sent a message with custom worker message handler', async (t) => {
  t.plan(3);

  const logger = {
    error: () => {},
    info: () => {}
  };

  const bree = new Bree({
    root,
    jobs: [{ name: 'message' }],
    logger,
    workerMessageHandler: (metadata) => {
      t.is(Object.keys(metadata).length, 2);
      t.is(metadata.message, 'hey Bob!');
      t.is(metadata.name, 'message');
    }
  });

  bree.run('message');

  bree.workers.message.postMessage('hey Bob!');

  await once(bree.workers.message, 'exit');
});

test('job sent a message with custom worker message handler and metadata', async (t) => {
  t.plan(4);

  const logger = {
    error: () => {},
    info: () => {}
  };

  const bree = new Bree({
    root,
    jobs: [{ name: 'message' }],
    logger,
    outputWorkerMetadata: true,
    workerMessageHandler: (metadata) => {
      t.is(Object.keys(metadata).length, 3);
      t.is(metadata.message, 'hi Alice!');
      t.is(metadata.name, 'message');
      t.is(Object.keys(metadata.worker).length, 3);
    }
  });

  bree.run('message');

  bree.workers.message.postMessage('hi Alice!');

  await once(bree.workers.message, 'exit');
});

test('jobs run all when no name designated', async (t) => {
  const logger = {};
  logger.info = () => {};

  const bree = new Bree({
    root,
    jobs: ['basic'],
    logger
  });

  bree.run();
  await delay(1);

  t.true(typeof bree.workers.basic === 'object');

  const [code] = await once(bree.workers.basic, 'exit');
  t.is(code, 0);

  t.true(typeof bree.workers.basic === 'undefined');
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

  bree.run('basic');
  await delay(1);

  t.is(typeof bree.workers.basic, 'object');

  const [code] = await once(bree.workers.basic, 'exit');
  t.is(code, 0);

  t.is(typeof bree.workers.basic, 'undefined');
});

test('job runs and passes workerData from config', async (t) => {
  t.plan(4);
  const logger = {
    info: (...args) => {
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

  bree.run('worker-data');

  await delay(1);
  t.is(typeof bree.workers['worker-data'], 'object');

  const [code] = await once(bree.workers['worker-data'], 'exit');
  t.is(code, 0);

  t.is(typeof bree.workers['worker-data'], 'undefined');
});
