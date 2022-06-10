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

  await bree.run('long');
  await once(bree.workers.get('long'), 'online');
  t.true(bree.closeWorkerAfterMs.has('long'));

  const [code] = await once(bree.workers.get('long'), 'exit');
  t.is(code, 1);
  t.false(bree.closeWorkerAfterMs.has('long'));

  await bree.run('long');
  await once(bree.workers.get('long'), 'online');
  t.true(bree.closeWorkerAfterMs.has('long'));
});
