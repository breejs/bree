const path = require('path');
const { once } = require('events');
const FakeTimers = require('@sinonjs/fake-timers');

const test = require('ava');

const later = require('@breejs/later');
const delay = require('delay');
const Bree = require('../src');

const root = path.join(__dirname, 'jobs');

const noop = () => {
  /* noop */
};

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

  t.false(bree.timeouts.has('basic'));
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

  t.false(bree.timeouts.has('infinite'));

  bree.start('infinite');
  await delay(1);
  t.true(bree.timeouts.has('infinite'));

  await delay(20);

  t.false(bree.timeouts.has('infinite'));

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

  t.false(bree.intervals.has('short'));

  bree.start('short');

  await once(bree, 'worker created');
  t.log('first worker created');
  await delay(1);
  t.true(bree.intervals.has('short'));

  const [code] = await once(bree.workers.get('short'), 'exit');
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

  t.false(bree.intervals.has('short'));

  bree.start('short');

  await once(bree, 'worker created');
  await delay(1);
  t.true(bree.intervals.has('short'));

  const [code] = await once(bree.workers.get('short'), 'exit');
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

  t.false(bree.timeouts.has('short'));
  t.false(bree.intervals.has('short'));

  bree.start('short');
  t.true(bree.timeouts.has('short'));

  await once(bree, 'worker created');
  await delay(1);
  t.true(bree.intervals.has('short'));
  t.false(bree.timeouts.has('short'));

  const [code] = await once(bree.workers.get('short'), 'exit');
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

  t.false(bree.timeouts.has('short'));
  t.false(bree.intervals.has('short'));

  bree.start('short');
  t.true(bree.timeouts.has('short'));

  await once(bree, 'worker created');
  await delay('1');
  t.true(bree.intervals.has('short'));
  t.false(bree.timeouts.has('short'));

  const [code] = await once(bree.workers.get('short'), 'exit');
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

  t.false(bree.timeouts.has('short'));

  bree.start('short');

  t.true(bree.timeouts.has('short'));

  await once(bree, 'worker created');

  await delay(1);

  t.false(bree.timeouts.has('short'));

  const [code] = await once(bree.workers.get('short'), 'exit');
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

  t.false(bree.timeouts.has('infinite'));
  t.false(bree.intervals.has('infinite'));

  bree.start('infinite');
  t.true(bree.timeouts.has('infinite'));

  await once(bree, 'worker created');
  await delay(1);
  t.true(bree.intervals.has('infinite'));
  t.false(bree.timeouts.has('infinite'));

  const [code] = await once(bree.workers.get('infinite'), 'exit');
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

  t.false(bree.timeouts.has('infinite'));
  t.false(bree.intervals.has('infinite'));

  bree.start('infinite');
  t.true(bree.timeouts.has('infinite'));

  await once(bree, 'worker created');
  await delay(1);
  t.true(bree.intervals.has('infinite'));
  t.false(bree.timeouts.has('infinite'));

  const [code] = await once(bree.workers.get('infinite'), 'exit');
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
  t.true(bree.intervals.has('infinite'));

  const [code] = await once(bree.workers.get('infinite'), 'exit');
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
  t.true(bree.intervals.has('infinite'));

  const [code] = await once(bree.workers.get('infinite'), 'exit');
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

test.serial('uses job.timezone to schedule a job', (t) => {
  t.plan(3);

  const datetimeNow = new Date('2021-08-22T10:30:00.000-04:00'); // zone = America/New_York

  const clock = FakeTimers.install({
    now: datetimeNow.getTime()
  });

  const bree = new Bree({
    root,
    jobs: [
      // todo: job.date
      {
        name: 'tz_cron',
        path: noop,
        timezone: 'America/Mexico_City',
        cron: '30 10 * * *'
      },
      {
        name: 'tz_interval',
        path: noop,
        timezone: 'Europe/Athens',
        interval: later.parse.cron('30 18 * * *')
      },
      {
        name: 'tz_timeout',
        path: noop,
        timezone: 'Australia/Canberra',
        timeout: later.parse.cron('30 1 * * *')
      }
    ]
  });

  clock.setTimeout = (fn, ms) => {
    t.is(ms, 36e5);
  };

  bree.start('tz_cron');
  bree.start('tz_interval');
  bree.start('tz_timeout');

  clock.uninstall();
});

test.serial('uses default timezone to schedule a job', (t) => {
  t.plan(6);

  const datetimeNow = new Date('2021-08-22T10:30:00.000-04:00'); // zone = America/New_York

  const clock = FakeTimers.install({
    now: datetimeNow.getTime()
  });

  const bree = new Bree({
    timezone: 'America/Mexico_City',
    root,
    jobs: [
      // todo: job.date
      {
        name: 'tz_cron',
        path: noop,
        cron: '0 10 * * *'
      },
      {
        name: 'tz_interval',
        path: noop,
        interval: later.parse.cron('0 10 * * *')
      },
      {
        name: 'tz_timeout',
        path: noop,
        timeout: later.parse.cron('0 10 * * *')
      }
    ]
  });

  for (const job of bree.config.jobs) t.is(job.timezone, 'America/Mexico_City');

  clock.setTimeout = (fn, ms) => {
    t.is(ms, 18e5);
  };

  bree.start('tz_cron');
  bree.start('tz_interval');
  bree.start('tz_timeout');

  clock.uninstall();
});
