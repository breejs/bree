const path = require('path');
const { once } = require('events');

const test = require('ava');

const delay = require('delay');
const Bree = require('../src');

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

  t.false(bree.workers.has('message'));

  await bree.start('message');
  await delay(10);

  t.true(bree.workers.has('message'));

  await bree.stop();

  t.false(bree.workers.has('message'));
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

  t.false(bree.workers.has('message-process-exit'));

  await bree.start('message-process-exit');
  await delay(10);

  t.true(bree.workers.has('message-process-exit'));

  await bree.stop();

  t.false(bree.workers.has('message-process-exit'));
});

test('does not send graceful notice if no cancelled message', async (t) => {
  const logger = {
    info(message) {
      if (message === 'Gracefully cancelled worker for job "message"') {
        t.fail();
      }
    },
    error() {}
  };

  const bree = new Bree({
    root,
    jobs: ['message-ungraceful'],
    logger
  });

  await bree.start('message-ungraceful');
  await delay(10);
  console.log(bree);
  await bree.stop('message-ungraceful');

  t.pass();
});

test('clears closeWorkerAfterMs', async (t) => {
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', closeWorkerAfterMs: 10 }]
  });

  t.false(bree.closeWorkerAfterMs.has('basic'));

  await bree.run('basic');

  await once(bree.workers.get('basic'), 'online');
  t.true(bree.closeWorkerAfterMs.has('basic'));

  await bree.stop('basic');

  t.false(bree.closeWorkerAfterMs.has('basic'));
});

test('deletes closeWorkerAfterMs', async (t) => {
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', closeWorkerAfterMs: 10 }]
  });

  t.false(bree.closeWorkerAfterMs.has('basic'));

  await bree.run('basic');

  await once(bree.workers.get('basic'), 'online');
  t.true(bree.closeWorkerAfterMs.has('basic'));

  await once(bree.workers.get('basic'), 'exit');

  bree.closeWorkerAfterMs.set('basic', 'test');
  await bree.stop('basic');

  t.false(bree.closeWorkerAfterMs.has('basic'));
});

test('clears timeouts', async (t) => {
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', timeout: 1000 }]
  });

  t.false(bree.timeouts.has('basic'));

  await bree.start('basic');
  await bree.stop('basic');

  t.false(bree.timeouts.has('basic'));
});

test('deletes timeouts', async (t) => {
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', timeout: 1000 }]
  });

  t.false(bree.timeouts.has('basic'));

  await bree.start('basic');
  bree.timeouts.set('basic', 'test');
  await bree.stop('basic');

  t.false(bree.timeouts.has('basic'));
});

test('deletes intervals', async (t) => {
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', interval: 1000 }]
  });

  t.false(bree.intervals.has('basic'));

  await bree.start('basic');
  bree.intervals.set('basic', 'test');
  await bree.stop('basic');

  t.false(bree.intervals.has('basic'));
});
