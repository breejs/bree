const path = require('path');
const test = require('ava');
const delay = require('delay');
const humanInterval = require('human-interval');
const FakeTimers = require('@sinonjs/fake-timers');

const Bree = require('../src');

const root = path.join(__dirname, 'jobs');
const baseConfig = {
  root,
  timeout: 0,
  interval: 0,
  hasSeconds: false,
  defaultExtension: 'js'
};

test('successfully run job', async (t) => {
  t.plan(2);

  const logger = {
    info: () => {}
  };

  const bree = new Bree({
    jobs: ['infinite'],
    ...baseConfig,
    logger
  });

  bree.start();

  bree.on('worker created', (name) => {
    t.true(typeof bree.workers[name] === 'object');
  });

  bree.on('worker deleted', (name) => {
    t.true(typeof bree.workers[name] === 'undefined');
  });

  await delay(100);

  await bree.stop();
});

test('preset and override is set if config.hasSeconds is "true"', (t) => {
  const bree = new Bree({
    jobs: ['basic'],
    ...baseConfig,
    hasSeconds: true
  });

  t.is(bree.config.cronValidate.preset, 'default');
  t.true(typeof bree.config.cronValidate.override === 'object');
});

test('preset and override is set by cronValidate config', (t) => {
  const bree = new Bree({
    jobs: ['basic'],
    ...baseConfig,
    hasSeconds: true,
    cronValidate: {
      preset: 'test',
      override: { test: 'works' }
    }
  });

  t.is(bree.config.cronValidate.preset, 'test');
  t.true(typeof bree.config.cronValidate.override === 'object');
  t.is(bree.config.cronValidate.override.test, 'works');
});

test('throws if jobs is not an array', (t) => {
  t.throws(
    () =>
      new Bree({
        jobs: null,
        ...baseConfig,
        root: path.join(__dirname, 'noIndexJobs')
      }),
    {
      message: 'Jobs must be an Array'
    }
  );
});

test('throws during constructor if job-validator throws', (t) => {
  t.throws(
    () =>
      new Bree({
        jobs: [{ name: 'basic', hasSeconds: 'test' }],
        ...baseConfig
      }),
    {
      message:
        'Job #1 named "basic" had hasSeconds value of test (it must be a Boolean)'
    }
  );
});

test('emits "worker created" and "worker started" events', async (t) => {
  t.plan(2);

  const bree = new Bree({
    root,
    jobs: ['basic'],
    timeout: 100
  });

  bree.start();

  bree.on('worker created', (name) => {
    t.true(typeof bree.workers[name] === 'object');
  });
  bree.on('worker deleted', (name) => {
    t.true(typeof bree.workers[name] === 'undefined');
  });

  await delay(1000);

  await bree.stop();
});

test.serial('job with long timeout runs', (t) => {
  t.plan(2);

  const bree = new Bree({
    root,
    jobs: ['infinite'],
    timeout: '3 months'
  });

  t.is(bree.config.jobs[0].timeout, humanInterval('3 months'));

  const now = Date.now();
  const clock = FakeTimers.install({ now: Date.now() });

  bree.start('infinite');
  bree.on('worker created', () => {
    // Only complicated because of runtime - this removes flakiness
    t.true(
      clock.now - now === humanInterval('3 months') ||
        clock.now - now === humanInterval('3 months') + 1
    );
  });
  // Should run till worker stops running
  clock.runAll();

  clock.uninstall();
});

test.serial('job created with cron string is using local timezone', (t) => {
  t.plan(2);
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', cron: '0 18 * * *' }]
  });

  const clock = FakeTimers.install({ now: Date.now() });
  bree.start('basic');
  bree.on('worker created', () => {
    const now = new Date(clock.now);
    const offsetOfLocalDates = new Date().getTimezoneOffset();

    t.is(now.getTimezoneOffset(), offsetOfLocalDates);
    t.is(now.getHours(), 18);
  });
  clock.next();
  clock.uninstall();
});

test.serial('job created with human interval is using local timezone', (t) => {
  t.plan(2);
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', interval: 'at 13:26' }]
  });

  const clock = FakeTimers.install({ now: Date.now() });
  bree.start('basic');
  bree.on('worker created', () => {
    const now = new Date(clock.now);
    t.is(now.getHours(), 13);
    t.is(now.getMinutes(), 26);
  });
  clock.next();
  clock.uninstall();
});

test('throws if acceptedExtensions is not an array', (t) => {
  t.throws(
    () =>
      new Bree({
        jobs: ['basic'],
        ...baseConfig,
        acceptedExtensions: 'test string'
      }),
    { message: '`acceptedExtensions` must be defined and an Array' }
  );
});

test('throws if acceptedExtensions is false', (t) => {
  t.throws(
    () =>
      new Bree({
        jobs: ['basic'],
        ...baseConfig,
        acceptedExtensions: false
      }),
    { message: '`acceptedExtensions` must be defined and an Array' }
  );
});
