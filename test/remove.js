const path = require('path');
const delay = require('delay');
const test = require('ava');

const Bree = require('../src');

const root = path.join(__dirname, 'jobs');

test('successfully remove jobs', async (t) => {
  const bree = new Bree({
    root,
    jobs: ['basic', 'infinite']
  });

  t.is(typeof bree.config.jobs[1], 'object');

  await bree.remove('infinite');

  t.is(typeof bree.config.jobs[1], 'undefined');
});

test('remove > successfully remove and stop jobs', async (t) => {
  const bree = new Bree({
    root,
    jobs: ['loop']
  });
  bree.start('loop');
  await delay(10);

  t.is(bree.config.jobs[0].name, 'loop');
  t.true(typeof bree.workers.loop === 'object');

  await bree.remove('loop');

  t.is(typeof bree.config.jobs[0], 'undefined');
  t.is(typeof bree.workers.loop, 'undefined');
});

test('remove > fails if job does not exist', async (t) => {
  const bree = new Bree({
    root,
    jobs: ['infinite']
  });

  await t.throwsAsync(() => bree.remove('basic'), {
    message: /Job .* does not exist/
  });
});
