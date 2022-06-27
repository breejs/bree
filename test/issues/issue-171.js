const path = require('path');
const { SHARE_ENV } = require('worker_threads');

const test = require('ava');

const Bree = require('../../src');

const root = path.join(__dirname, '../jobs');

test('works with SHARE_ENV using top-level', async (t) => {
  const bree = new Bree({
    root,
    worker: {
      env: SHARE_ENV
    },
    jobs: [{ name: 'long', closeWorkerAfterMs: 2000 }]
  });

  await t.notThrowsAsync(bree.run('long'));
});

test('works with SHARE_ENV using job-specific', async (t) => {
  const bree = new Bree({
    root,
    jobs: [
      { name: 'long', closeWorkerAfterMs: 2000, worker: { env: SHARE_ENV } }
    ]
  });

  await t.notThrowsAsync(bree.run('long'));
});

test('works with SHARE_ENV using both', async (t) => {
  const bree = new Bree({
    root,
    worker: {
      env: SHARE_ENV
    },
    jobs: [
      { name: 'long', closeWorkerAfterMs: 2000, worker: { env: SHARE_ENV } }
    ]
  });

  await t.notThrowsAsync(bree.run('long'));
});
