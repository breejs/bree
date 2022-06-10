const path = require('path');
const { once } = require('events');

const test = require('ava');

const Bree = require('../../../src');

const root = path.join(__dirname, 'jobs');

test('defaultRootIndex as an ESM module', async (t) => {
  const bree = new Bree({
    root,
    defaultRootIndex: 'index.mjs'
  });

  await bree.run('job');
  await once(bree.workers.get('job'), 'online');

  const [code] = await once(bree.workers.get('job'), 'exit');
  t.is(code, 0);
});

test('defaultRootIndex as an ESM module throws error when no default export', async (t) => {
  const bree = new Bree({
    root: path.join(__dirname, 'jobs-no-default-export'),
    defaultRootIndex: 'index.mjs'
  });

  const err = await t.throwsAsync(bree.run('job'));
  t.regex(err.message, /Root index file missing default export at/);
});
