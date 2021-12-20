const path = require('path');
const { once } = require('events');

const test = require('ava');

const Bree = require('../../src');

const root = path.join(__dirname, '../jobs');

test('job terminates after closeWorkerAfterMs and allows run after', async (t) => {
  t.plan(4);

  const logger = {};
  logger.info = () => {};
  logger.error = () => {};

  const bree = new Bree({
    root,
    jobs: [{ name: 'long', closeWorkerAfterMs: 2000 }],
    logger
  });

  bree.run('long');
  await once(bree.workers.long, 'online');
  t.true(typeof bree.closeWorkerAfterMs.long === 'object');

  const [code] = await once(bree.workers.long, 'exit');
  t.is(code, 1);
  t.true(typeof bree.closeWorkerAfterMs.long === 'undefined');

  bree.run('long');
  await once(bree.workers.long, 'online');
  t.true(typeof bree.closeWorkerAfterMs.long === 'object');
});
