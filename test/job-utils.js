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

test('getName: extracts job name from a function', (t) => {
  const fn = () => {
    return true;
  };

  t.is(jobUtils.getName(fn), 'fn');
});

test('getHumanToMs: converts values into milliseconds', (t) => {
  t.is(jobUtils.getHumanToMs('100'), 100);
});

test('getHumanToMs: supports human readable format', (t) => {
  t.is(jobUtils.getHumanToMs('minute'), 60_000);
});

test('parseValue: does not parse false value', (t) => {
  t.false(jobUtils.parseValue(false));
});

test('parseValue: returns unmodified schedule value', (t) => {
  t.deepEqual(jobUtils.parseValue({ schedules: [1] }), { schedules: [1] });
});

test('parseValue: parses human readable values', (t) => {
  t.deepEqual(jobUtils.parseValue('every day'), {
    error: 6,
    exceptions: [],
    schedules: [{ D: [1] }]
  });
});

test('parseValue: parses millisecond values', (t) => {
  t.is(jobUtils.parseValue('100'), 100);
});

test('parseValue: throws for invalid value', (t) => {
  t.throws(() => jobUtils.parseValue(-1), {
    message:
      'Value "-1" must be a finite number >= 0 or a String parseable by `later.parse.text` (see <https://breejs.github.io/later/parsers.html#text> for examples)'
  });
});

test('parseValue: throws if string value is neither a later nor human-interval format', (t) => {
  const invalidStringValue = 'on the fifth day of the month';
  t.throws(() => jobUtils.parseValue(invalidStringValue), {
    message: `Value "${invalidStringValue}" is not a String parseable by \`later.parse.text\` (see <https://breejs.github.io/later/parsers.html#text> for examples)`
  });
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
