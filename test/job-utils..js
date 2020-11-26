const test = require('ava');

const jobUtils = require('../src/job-utils');

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
