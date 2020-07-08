const path = require('path');

const test = require('ava');

const Bree = require('..');

test('creates a basic job and runs it', async (t) => {
  const bree = new Bree({
    root: path.join(__dirname, 'jobs'),
    jobs: ['basic']
  });

  bree.start();
  await new Promise((resolve) => setTimeout(resolve, 1));
  t.log(bree);
  t.true(typeof bree.workers.basic === 'object');
  await new Promise((resolve, reject) => {
    bree.workers.basic.on('error', reject);
    bree.workers.basic.on('exit', (code) => {
      t.true(code === 0);
      resolve();
    });
  });
  t.true(typeof bree.workers.basic === 'undefined');
  bree.stop();
});
