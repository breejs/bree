const path = require('path');

const test = require('ava');

const Bree = require('../src');

const root = path.join(__dirname, 'jobs');

test('successfully remove jobs', (t) => {
  const bree = new Bree({
    root,
    jobs: ['basic', 'infinite']
  });

  t.is(typeof bree.config.jobs[1], 'object');

  bree.remove('infinite');

  t.is(typeof bree.config.jobs[1], 'undefined');
});

test('fails if job does not exist', (t) => {
  const bree = new Bree({
    root,
    jobs: ['infinite']
  });

  t.throws(() => bree.remove('basic'), { message: /Job .* does not exist/ });
});
