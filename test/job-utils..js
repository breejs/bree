const test = require('ava');

const jobUtils = require('../src/job-utils');

test('isSchedule: passes for valid schedule object', (t) => {
  const isSchedule = jobUtils.isSchedule({ schedules: [] });

  t.true(isSchedule);
});

test('isSchedule: fails for invalid schedule object', (t) => {
  const isSchedule = jobUtils.isSchedule([]);

  t.false(isSchedule);
});

test('getName: extracts job name from a string', (t) => {
  t.is(jobUtils.getName('job-name'), 'job-name');
});

test('getName: extracts job name from an object', (t) => {
  t.is(jobUtils.getName({ name: 'job-name' }), 'job-name');
});

test('getHumanToMs: converts values into milliseconds', (t) => {
  t.is(jobUtils.getHumanToMs('100'), 100);
});

test('getHumanToMs: supports human readable format', (t) => {
  t.is(jobUtils.getHumanToMs('minute'), 60000);
});

test('getJobNames: returns all jobNames', (t) => {
  const names = jobUtils.getJobNames(['hey', { name: 'hello' }]);

  t.deepEqual(names, ['hey', 'hello']);
});

test('getJobNames: ignores name at specific index', (t) => {
  const names = jobUtils.getJobNames(['hey', { name: 'hello' }, 'ignored'], 2);

  t.deepEqual(names, ['hey', 'hello']);
});

test('getJobNames: ignores jobs with no valid name', (t) => {
  const names = jobUtils.getJobNames([
    'hey',
    { name: 'hello' },
    { prop: 'no name' }
  ]);

  t.deepEqual(names, ['hey', 'hello']);
});
