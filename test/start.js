const path = require('path');
const { once } = require('events');

const test = require('ava');

const Bree = require('../src');
const later = require('@breejs/later');
const delay = require('delay');

const root = path.join(__dirname, 'jobs');

test('throws error if job does not exist', (t) => {
  const bree = new Bree({
    root,
    jobs: ['basic']
  });

  t.throws(() => bree.start('leroy'), { message: 'Job leroy does not exist' });
});

test('fails if job already started', async (t) => {
  t.plan(1);

  const logger = {};
  logger.warn = (err) => {
    t.is(err.message, 'Job "short" is already started');
  };

  logger.info = () => {};

  logger.error = () => {};

  const bree = new Bree({
    root,
    jobs: ['short'],
    logger
  });

  bree.start('short');
  await delay(1);
  bree.start('short');
  await delay(1);

  await bree.stop();
});

test('fails if date is in the past', async (t) => {
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', date: new Date(Date.now() - 10) }]
  });

  bree.start('basic');
  await delay(1);

  t.is(typeof bree.timeouts.basic, 'undefined');
  await delay(1);

  await bree.stop();
});

test('sets timeout if date is in the future', async (t) => {
  const bree = new Bree({
    root,
    jobs: [
      {
        name: 'infinite',
        date: new Date(Date.now() + 10)
      }
    ]
  });

  t.is(typeof bree.timeouts.infinite, 'undefined');

  bree.start('infinite');
  await delay(1);
  t.is(typeof bree.timeouts.infinite, 'object');

  await delay(20);

  t.is(typeof bree.timeouts.infinite, 'undefined');

  await bree.stop();
});

test('sets interval if date is in the future and interval is schedule', async (t) => {
  t.plan(4);

  const bree = new Bree({
    root,
    jobs: [
      {
        name: 'short',
        date: new Date(Date.now() + 10),
        interval: later.parse.text('every 1 second')
      }
    ]
  });

  t.is(typeof bree.intervals.short, 'undefined');

  bree.start('short');

  await once(bree, 'worker created');
  t.log('first worker created');
  await delay(1);
  t.is(typeof bree.intervals.short, 'object');

  const [code] = await once(bree.workers.short, 'exit');
  t.log('timeout runs');
  t.is(code, 2);

  await once(bree, 'worker created');
  t.log('second worker created');
  t.pass();

  await bree.stop();
});

test('sets interval if date is in the future and interval is number', async (t) => {
  t.plan(4);

  const bree = new Bree({
    root,
    jobs: [
      {
        name: 'short',
        date: new Date(Date.now() + 10),
        interval: 1000
      }
    ]
  });

  t.is(typeof bree.intervals.short, 'undefined');

  bree.start('short');

  await once(bree, 'worker created');
  await delay(1);
  t.is(typeof bree.intervals.short, 'object');

  const [code] = await once(bree.workers.short, 'exit');
  t.is(code, 2);

  await once(bree, 'worker created');
  t.pass();

  await bree.stop();
});

test('sets timeout if interval is schedule and timeout is schedule', async (t) => {
  t.plan(7);

  const bree = new Bree({
    root,
    jobs: [
      {
        name: 'short',
        timeout: later.parse.text('every 1 sec'),
        interval: later.parse.text('every 1 sec')
      }
    ]
  });

  t.is(typeof bree.timeouts.short, 'undefined');
  t.is(typeof bree.intervals.short, 'undefined');

  bree.start('short');
  t.is(typeof bree.timeouts.short, 'object');

  await once(bree, 'worker created');
  await delay(1);
  t.is(typeof bree.intervals.short, 'object');
  t.is(typeof bree.timeouts.short, 'undefined');

  const [code] = await once(bree.workers.short, 'exit');
  t.is(code, 2);

  await once(bree, 'worker created');
  t.pass();

  await bree.stop();
});

test('sets timeout if interval is number and timeout is schedule', async (t) => {
  t.plan(7);

  const bree = new Bree({
    root,
    jobs: [
      {
        name: 'short',
        timeout: later.parse.text('every 1 sec'),
        interval: 1000
      }
    ]
  });

  t.is(typeof bree.timeouts.short, 'undefined');
  t.is(typeof bree.intervals.short, 'undefined');

  bree.start('short');
  t.is(typeof bree.timeouts.short, 'object');

  await once(bree, 'worker created');
  await delay('1');
  t.is(typeof bree.intervals.short, 'object');
  t.is(typeof bree.timeouts.short, 'undefined');

  const [code] = await once(bree.workers.short, 'exit');
  t.is(code, 2);

  await once(bree, 'worker created');
  t.pass();

  await bree.stop();
});

test('sets timeout if interval is 0 and timeout is schedule', async (t) => {
  t.plan(4);

  const bree = new Bree({
    root,
    jobs: [
      {
        name: 'short',
        timeout: later.parse.text('every 1 sec'),
        interval: 0
      }
    ]
  });

  t.is(typeof bree.timeouts.short, 'undefined');

  bree.start('short');

  t.is(typeof bree.timeouts.short, 'object');

  await once(bree, 'worker created');

  await delay(1);

  t.is(typeof bree.timeouts.short, 'undefined');

  const [code] = await once(bree.workers.short, 'exit');
  t.is(code, 2);

  await bree.stop();
});

test('sets timeout if interval is schedule and timeout is number', async (t) => {
  t.plan(7);

  const bree = new Bree({
    root,
    jobs: [
      {
        name: 'infinite',
        timeout: 10,
        interval: later.parse.text('every 1 sec')
      }
    ]
  });

  t.is(typeof bree.timeouts.infinite, 'undefined');
  t.is(typeof bree.intervals.infinite, 'undefined');

  bree.start('infinite');
  t.is(typeof bree.timeouts.infinite, 'object');

  await once(bree, 'worker created');
  await delay(1);
  t.is(typeof bree.intervals.infinite, 'object');
  t.is(typeof bree.timeouts.infinite, 'undefined');

  const [code] = await once(bree.workers.infinite, 'exit');
  t.true(code === 0);

  await once(bree, 'worker created');
  t.pass();

  await bree.stop();
});

test('sets timeout if interval is number and timeout is number', async (t) => {
  t.plan(7);

  const bree = new Bree({
    root,
    jobs: [
      {
        name: 'infinite',
        timeout: 10,
        interval: 10
      }
    ]
  });

  t.is(typeof bree.timeouts.infinite, 'undefined');
  t.is(typeof bree.intervals.infinite, 'undefined');

  bree.start('infinite');
  t.is(typeof bree.timeouts.infinite, 'object');

  await once(bree, 'worker created');
  await delay(1);
  t.is(typeof bree.intervals.infinite, 'object');
  t.is(typeof bree.timeouts.infinite, 'undefined');

  const [code] = await once(bree.workers.infinite, 'exit');
  t.true(code === 0);

  await once(bree, 'worker created');
  t.pass();

  await bree.stop();
});

test('sets interval if interval is schedule', async (t) => {
  t.plan(3);

  const bree = new Bree({
    root,
    jobs: ['infinite'],
    timeout: false,
    interval: later.parse.text('every 1 sec')
  });

  t.is(typeof bree.intervals.infinite, 'undefined');

  bree.start('infinite');

  await once(bree, 'worker created');
  t.is(typeof bree.intervals.infinite, 'object');

  const [code] = await once(bree.workers.infinite, 'exit');
  t.true(code === 0);

  await bree.stop();
});

test('sets interval if interval is number', async (t) => {
  t.plan(3);

  const bree = new Bree({
    root,
    jobs: ['infinite'],
    timeout: false,
    interval: 1000
  });

  t.is(typeof bree.intervals.infinite, 'undefined');

  bree.start('infinite');
  await once(bree, 'worker created');
  t.is(typeof bree.intervals.infinite, 'object');

  const [code] = await once(bree.workers.infinite, 'exit');
  t.true(code === 0);

  await bree.stop();
});

test('does not set interval if interval is 0', async (t) => {
  t.plan(2);

  const bree = new Bree({
    root,
    jobs: ['infinite'],
    timeout: false,
    interval: 0
  });

  t.is(typeof bree.intervals.infinite, 'undefined');

  bree.start('infinite');
  await delay(1);

  t.is(typeof bree.intervals.infinite, 'undefined');

  await bree.stop();
});
