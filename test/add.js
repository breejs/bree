const path = require('path');
const FakeTimers = require('@sinonjs/fake-timers');

const test = require('ava');

const Bree = require('../src');

const root = path.join(__dirname, 'jobs');

test('successfully add jobs as array', (t) => {
  const bree = new Bree({
    root,
    jobs: ['infinite']
  });

  t.is(typeof bree.config.jobs[1], 'undefined');

  bree.add(['basic']);

  t.is(typeof bree.config.jobs[1], 'object');
});

test('successfully add job not array', (t) => {
  const bree = new Bree({
    root,
    jobs: ['infinite']
  });

  t.is(typeof bree.config.jobs[1], 'undefined');

  bree.add('basic');

  t.is(typeof bree.config.jobs[1], 'object');
});

test('fails if job already exists', (t) => {
  const bree = new Bree({
    root,
    jobs: ['basic']
  });

  t.throws(() => bree.add(['basic']), {
    message: /Job .* has a duplicate job name of */
  });
});

test('successfully adds job object', (t) => {
  const bree = new Bree({ root: false });
  function noop() {}
  bree.add({ name: 'basic', path: noop.toString() });
  t.pass();
});

test('missing job name', (t) => {
  const logger = {};
  logger.error = () => {};
  logger.info = () => {};

  const bree = new Bree({
    root: false,
    logger
  });
  t.throws(() => bree.add(), { message: /Job .* is missing a name/ });
});

test.serial('job created with cron string is using local timezone', (t) => {
  t.plan(2);
  const bree = new Bree({
    root: false
  });

  bree.add({
    name: 'basic',
    cron: '0 18 * * *',
    path: path.join(__dirname, 'jobs/basic.js')
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
