const path = require('path');
const FakeTimers = require('@sinonjs/fake-timers');

const test = require('ava');

const Bree = require('../src');

const root = path.join(__dirname, 'jobs');

test('successfully add jobs as array', async (t) => {
  const bree = new Bree({
    root,
    jobs: ['infinite']
  });

  t.is(typeof bree.config.jobs[1], 'undefined');

  const added = await bree.add(['basic']);

  t.is(added[0].name, 'basic');

  t.is(typeof bree.config.jobs[1], 'object');
});

test('successfully add job not array', async (t) => {
  const bree = new Bree({
    root,
    jobs: ['infinite']
  });

  t.is(typeof bree.config.jobs[1], 'undefined');

  const added = await bree.add('basic');

  t.is(added[0].name, 'basic');

  t.is(typeof bree.config.jobs[1], 'object');
});

test('fails if job already exists', async (t) => {
  const bree = new Bree({
    root,
    jobs: ['basic']
  });

  const err = await t.throwsAsync(bree.add(['basic']));
  t.regex(err.message, /Job .* has a duplicate job name of */);
  t.falsy(bree.config.jobs[1]);
});

test('successfully adds job object', async (t) => {
  const bree = new Bree({ root: false });
  function noop() {}
  await bree.add({ name: 'basic', path: noop.toString() });
  t.pass();
});

test('missing job name', async (t) => {
  const logger = {};
  logger.error = () => {};
  logger.info = () => {};

  const bree = new Bree({
    root: false,
    logger
  });

  const err = await t.throwsAsync(bree.add());
  t.regex(err.message, /Job .* is missing a name/);
});

test.serial(
  'job created with cron string is using local timezone',
  async (t) => {
    t.plan(2);
    const bree = new Bree({
      root: false
    });

    await bree.add({
      name: 'basic',
      cron: '0 18 * * *',
      path: path.join(__dirname, 'jobs/basic.js')
    });

    const clock = FakeTimers.install({ now: Date.now() });
    await bree.start('basic');
    bree.on('worker created', () => {
      const now = new Date(clock.now);
      const offsetOfLocalDates = new Date().getTimezoneOffset();

      t.is(now.getTimezoneOffset(), offsetOfLocalDates);
      t.is(now.getHours(), 18);
    });
    clock.next();
    clock.uninstall();
  }
);
