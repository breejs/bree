const path = require('path');
const { once } = require('events');

const test = require('ava');

const Bree = require('../src');
const delay = require('delay');

const root = path.join(__dirname, 'jobs');

test('job stops when "cancel" message is sent', async (t) => {
  t.plan(4);

  const logger = {};
  logger.info = (message) => {
    if (message === 'Gracefully cancelled worker for job "message"') {
      t.true(true);
    }
  };

  logger.error = () => {};

  const bree = new Bree({
    root,
    jobs: [{ name: 'message' }],
    logger
  });

  t.is(typeof bree.workers.message, 'undefined');

  bree.start('message');
  await delay(1);

  t.is(typeof bree.workers.message, 'object');

  await bree.stop();

  t.is(typeof bree.workers.message, 'undefined');
});

test('job stops when process.exit(0) is called', async (t) => {
  t.plan(4);

  const logger = {};
  logger.info = (message) => {
    if (
      message === 'Worker for job "message-process-exit" exited with code 0'
    ) {
      t.true(true);
    }
  };

  const bree = new Bree({
    root,
    jobs: [{ name: 'message-process-exit' }],
    logger
  });

  t.is(typeof bree['message-process-exit'], 'undefined');

  bree.start('message-process-exit');
  await delay(1);

  t.is(typeof bree.workers['message-process-exit'], 'object');

  await bree.stop();

  t.is(typeof bree.workers['message-process-exit'], 'undefined');
});

test('does not send graceful notice if no cancelled message', async (t) => {
  const logger = {
    info: (message) => {
      if (message === 'Gracefully cancelled worker for job "message"') {
        t.fail();
      }
    },
    error: () => {}
  };

  const bree = new Bree({
    root,
    jobs: ['message-ungraceful'],
    logger
  });

  bree.start('message-ungraceful');
  await delay(1);
  console.log(bree);
  await bree.stop('message-ungraceful');

  t.pass();
});

test('clears closeWorkerAfterMs', async (t) => {
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', closeWorkerAfterMs: 10 }]
  });

  t.is(typeof bree.closeWorkerAfterMs.basic, 'undefined');

  bree.run('basic');

  await once(bree.workers.basic, 'online');
  t.is(typeof bree.closeWorkerAfterMs.basic, 'object');

  await bree.stop('basic');

  t.is(typeof bree.closeWorkerAfterMs.basic, 'undefined');
});

test('deletes closeWorkerAfterMs', async (t) => {
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', closeWorkerAfterMs: 10 }]
  });

  t.is(typeof bree.closeWorkerAfterMs.basic, 'undefined');

  bree.run('basic');

  await once(bree.workers.basic, 'online');
  t.is(typeof bree.closeWorkerAfterMs.basic, 'object');

  await once(bree.workers.basic, 'exit');

  bree.closeWorkerAfterMs.basic = 'test';
  await bree.stop('basic');

  t.is(typeof bree.closeWorkerAfterMs.basic, 'undefined');
});

test('clears timeouts', async (t) => {
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', timeout: 1000 }]
  });

  t.is(typeof bree.timeouts.basic, 'undefined');

  bree.start('basic');
  await bree.stop('basic');

  t.is(typeof bree.timeouts.basic, 'undefined');
});

test('deletes timeouts', async (t) => {
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', timeout: 1000 }]
  });

  t.is(typeof bree.timeouts.basic, 'undefined');

  bree.start('basic');
  bree.timeouts.basic = 'test';
  await bree.stop('basic');

  t.is(typeof bree.timeouts.basic, 'undefined');
});

test('deletes intervals', async (t) => {
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', interval: 1000 }]
  });

  t.is(typeof bree.intervals.basic, 'undefined');

  bree.start('basic');
  bree.intervals.basic = 'test';
  await bree.stop('basic');

  t.is(typeof bree.intervals.basic, 'undefined');
});
