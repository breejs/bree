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

test('throws error if job does not exist', async (t) => {
  const bree = new Bree({
    root,
    jobs: ['basic']
  });

  await bree.init();

  const err = await t.throwsAsync(bree.start('leroy'));
  t.is(err.message, 'Job leroy does not exist');
});

test('fails if job already started', async (t) => {
  await t.throwsAsync(
    async () => {
      const bree = new Bree({
        root,
        jobs: ['short']
      });
      await bree.init();
      await bree.start('short');
      await delay(10);
      await bree.start('short');
      await delay(10);

      await bree.stop();
    },
    {
      message: `Job "short" is already started`
    }
  );
});

test('fails if date is in the past', async (t) => {
  t.plan(3);

  const logger = {
    warn(msg) {
      t.is(msg, `Job "basic" was skipped because it was in the past.`);
    }
  };

  const bree = new Bree({
    root,
    logger,
    jobs: [{ name: 'basic', date: new Date(Date.now() - 10) }]
  });

  await bree.init();

  bree.on('job past', (name) => {
    t.is(name, 'basic');
  });

  await bree.start('basic');
  await delay(10);

  t.false(bree.timeouts.has('basic'));
  await delay(10);

  await bree.stop();
});

test('sets timeout if date is in the future', async (t) => {
  const bree = new Bree({
    root,
    jobs: [
      {
        name: 'infinite',
        date: new Date(Date.now() + 500)
      }
    ]
  });

  await bree.init();
  t.false(bree.timeouts.has('infinite'));
  await bree.start('infinite');
  await delay(20);
  t.true(bree.timeouts.has('infinite'));

  await delay(500);

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
        date: new Date(Date.now() + 1000),
        interval: later.parse.text('every 1 second')
      }
    ]
  });

  await bree.init();

  t.false(bree.intervals.has('short'));

  await bree.start('short');

  await once(bree, 'worker created');
  await delay(10);
  t.true(bree.intervals.has('short'));

  const [code] = await once(bree.workers.get('short'), 'exit');
  t.is(code, 2);

  await once(bree, 'worker created');
  await delay(10);
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
        date: new Date(Date.now() + 100),
        interval: 1000
      }
    ]
  });

  await bree.init();

  t.false(bree.intervals.has('short'));

  await bree.start('short');

  await once(bree, 'worker created');
  await delay(10);
  t.true(bree.intervals.has('short'));

  const [code] = await once(bree.workers.get('short'), 'exit');
  t.is(code, 2);

  await once(bree, 'worker created');
  await delay(10);
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

  await bree.init();

  t.false(bree.timeouts.has('short'));
  t.false(bree.intervals.has('short'));

  await bree.start('short');
  t.true(bree.timeouts.has('short'));

  await once(bree, 'worker created');
  await delay(10);
  t.true(bree.intervals.has('short'));
  t.false(bree.timeouts.has('short'));

  const [code] = await once(bree.workers.get('short'), 'exit');
  t.is(code, 2);

  await once(bree, 'worker created');
  await delay(10);
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

  await bree.init();

  t.false(bree.timeouts.has('short'));
  t.false(bree.intervals.has('short'));

  await bree.start('short');
  t.true(bree.timeouts.has('short'));

  await once(bree, 'worker created');
  await delay(10);
  t.true(bree.intervals.has('short'));
  t.false(bree.timeouts.has('short'));

  const [code] = await once(bree.workers.get('short'), 'exit');
  t.is(code, 2);

  await once(bree, 'worker created');
  await delay(10);
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

  await bree.init();

  t.false(bree.timeouts.has('short'));

  await bree.start('short');

  t.true(bree.timeouts.has('short'));

  await once(bree, 'worker created');
  await delay(10);

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

  await bree.init();

  t.false(bree.timeouts.has('infinite'));
  t.false(bree.intervals.has('infinite'));

  await bree.start('infinite');
  t.true(bree.timeouts.has('infinite'));

  await once(bree, 'worker created');
  await delay(10);
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

  await bree.init();

  t.false(bree.timeouts.has('infinite'));
  t.false(bree.intervals.has('infinite'));

  await bree.start('infinite');
  t.true(bree.timeouts.has('infinite'));

  await once(bree, 'worker created');
  await delay(10);
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

  await bree.init();

  t.is(typeof bree.intervals.infinite, 'undefined');

  await bree.start('infinite');

  await once(bree, 'worker created');
  await delay(10);
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

  await bree.init();

  t.is(typeof bree.intervals.infinite, 'undefined');

  await bree.start('infinite');
  await once(bree, 'worker created');
  await delay(10);
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

  await bree.init();

  t.is(typeof bree.intervals.infinite, 'undefined');

  await bree.start('infinite');
  await delay(10);

  t.is(typeof bree.intervals.infinite, 'undefined');

  await bree.stop();
});

test.serial('uses job.timezone to schedule a job', async (t) => {
  t.plan(3);

  const datetimeNow = new Date('2021-08-22T10:30:00.000-04:00'); // zone = America/New_York

  const clock = FakeTimers.install({
    now: datetimeNow.getTime()
  });

  const bree = new Bree({
    root,
    jobs: [
      // TODO: job.date
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

  await bree.init();

  clock.setTimeout = (fn, ms) => {
    t.is(ms, 36e5);
  };

  await bree.start('tz_cron');
  await bree.start('tz_interval');
  await bree.start('tz_timeout');

  clock.uninstall();
});

test.serial('uses default timezone to schedule a job', async (t) => {
  t.plan(6);

  const datetimeNow = new Date('2021-08-22T10:30:00.000-04:00'); // zone = America/New_York

  const clock = FakeTimers.install({
    now: datetimeNow.getTime()
  });

  const bree = new Bree({
    timezone: 'America/Mexico_City',
    root,
    jobs: [
      // TODO: job.date
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

  await bree.init();

  for (const job of bree.config.jobs) t.is(job.timezone, 'America/Mexico_City');

  clock.setTimeout = (fn, ms) => {
    t.is(ms, 18e5);
  };

  await bree.start('tz_cron');
  await bree.start('tz_interval');
  await bree.start('tz_timeout');

  clock.uninstall();
});
