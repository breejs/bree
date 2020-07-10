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

test.todo(
  'throws an error with an invalid root directory (e.g. directory does not exist)'
);
test.todo('does not throw an error when root directory option is set to false');
test.todo('job with just a name');
test.todo(
  'job with an invalid name throws an error (e.g. no matching file path)'
);
test.todo(
  'job with a name and an invalid file path throws an error (e.g. file does not exist)'
);
test.todo('job with a timeout');
test.todo('job with an interval');
test.todo('job with an interval uses the default timeout');
test.todo('job with a timeout and an interval');
test.todo('job with a false timeout and an interval');
test.todo('job with cron');
test.todo('job with date');
test.todo('job with date in the past does not run');
test.todo('job with cron that is invalid cron expression throws an error');
test.todo('job with custom worker instance options');
test.todo('job that combines date and cron');
test.todo('job that combines date and interval');
test.todo('job that combines timeout and cron');
