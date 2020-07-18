const _ = require('lodash');
const path = require('path');

const test = require('ava');
const FakeTimers = require('@sinonjs/fake-timers');

const Bree = require('..');
const later = require('later');
const delay = require('delay');

const root = path.join(__dirname, 'jobs');

test('creates a basic job and runs it', async (t) => {
  const logger = _.cloneDeep(console);
  logger.info = () => {};

  const bree = new Bree({
    root,
    jobs: ['basic'],
    logger
  });

  bree.start();
  await delay(1);

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

test('fails if root is not a directory', (t) => {
  t.throws(
    () =>
      new Bree({
        root: path.join(__dirname, 'jobs/basic.js'),
        jobs: ['basic']
      }),
    { message: /Root directory of .* does not exist/ }
  );
});

test('finds jobs from index.js', (t) => {
  const bree = new Bree({
    root,
    jobs: []
  });

  t.is(bree.config.jobs[0].name, 'basic');
});

test('fails if jobs is not an array', (t) => {
  t.throws(
    () =>
      new Bree({
        root: path.join(__dirname, 'noIndexJobs'),
        jobs: null,
        // hide MODULE_NOT_FOUND error
        logger: { error: () => {} }
      }),
    { message: 'Jobs must be an Array' }
  );
});

test('fails if duplicate job names when given names', (t) => {
  t.throws(
    () =>
      new Bree({
        root,
        jobs: ['basic', 'basic']
      }),
    { message: /Job .* has a duplicate job name of */ }
  );
});

test('fails if no root path given', (t) => {
  t.throws(
    () =>
      new Bree({
        root: null,
        jobs: ['basic']
      }),
    {
      message: /Job #.* ".*" requires root directory option to auto-populate path/
    }
  );
});

test('fails if job file does not exist', (t) => {
  t.throws(
    () =>
      new Bree({
        root,
        jobs: ['leroy']
      }),
    { message: /Job #.* ".*" path missing: */ }
  );
});

test('fails if job is not a pure object', (t) => {
  t.throws(
    () =>
      new Bree({
        root,
        jobs: [['basic']]
      }),
    { message: /Job #.* must be an Object/ }
  );
});

test('fails if job name is empty', (t) => {
  t.throws(
    () =>
      new Bree({
        root,
        jobs: [{ name: '' }]
      }),
    { message: /Job #.* must have a non-empty name/ }
  );
});

test('fails if job.path does not exist', (t) => {
  t.throws(
    () =>
      new Bree({
        root: null,
        jobs: [{ name: 'basic', path: null }]
      }),
    {
      message: /Job #.* named .* requires root directory option to auto-populate path/
    }
  );
});

test('fails if path is missing', (t) => {
  t.throws(
    () =>
      new Bree({
        root,
        jobs: [{ name: 'basic', path: path.join(__dirname, 'jobs/leroy.js') }]
      }),
    { message: /Job #.* named .* path missing: */ }
  );
});

test('creates path if root provided and path !isSANB', (t) => {
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', path: null }]
  });

  t.is(bree.config.jobs[0].path, path.join(__dirname, 'jobs/basic.js'));
});

test('fails if root path given but no name and path is empty', (t) => {
  t.throws(
    () =>
      new Bree({
        root,
        jobs: [{ path: '' }]
      }),
    { message: /Job #.* named .* path missing/ }
  );
});

test('fails if interval and cron are set', (t) => {
  t.throws(
    () =>
      new Bree({
        root,
        jobs: [{ name: 'basic', interval: '3s', cron: '* * * * *' }]
      }),
    {
      message: /Job #.* named .* cannot have both interval and cron configuration/
    }
  );
});

test('fails if timeout and date are set', (t) => {
  t.throws(
    () =>
      new Bree({
        root,
        jobs: [{ name: 'basic', timeout: '', date: '' }]
      }),
    { message: /Job #.* named .* cannot have both timeout and date/ }
  );
});

test('fails if duplicate job name and given objects', (t) => {
  t.throws(
    () =>
      new Bree({
        root,
        jobs: [{ name: 'basic' }, { name: 'basic' }]
      }),
    { message: /Job #.* named .* has a duplicate job name of */ }
  );
});

test('fails if date is invalid', (t) => {
  t.throws(
    () =>
      new Bree({
        root,
        jobs: [{ name: 'basic', date: null }]
      }),
    { message: /Job #.* named .* had an invalid Date of */ }
  );
});

test('creates job with correct timeout and uses default interval', (t) => {
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', timeout: '3s', interval: '1s' }]
  });

  t.is(bree.config.jobs[0].timeout, 3000);
  t.is(bree.config.jobs[0].interval, 1000);
});

test('fails if timeout is invalid', (t) => {
  t.throws(
    () =>
      new Bree({
        root,
        jobs: [{ name: 'basic', timeout: '' }]
      }),
    { message: /Job #.* named .* had an invalid timeout of */ }
  );
});

test('creates job with correct interval and uses default timeout', (t) => {
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', interval: '3s' }]
  });

  t.is(bree.config.jobs[0].interval, 3000);
  t.is(bree.config.jobs[0].timeout, 0);
});

test('fails if interval is invalid', (t) => {
  t.throws(
    () =>
      new Bree({
        root,
        jobs: [{ name: 'basic', interval: '' }]
      }),
    { message: /Job #.* named .* had an invalid interval of */ }
  );
});

test('creates cron job with schedule object', (t) => {
  const cron = later.parse.cron('* * * * *');
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', cron }]
  });

  t.is(bree.config.jobs[0].interval, cron);
});

test('creates job with cron string', (t) => {
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', cron: '* * * * *' }]
  });

  t.snapshot(bree.config.jobs[0].interval);
});

test('fails if cron pattern is invalid', (t) => {
  t.throws(
    () =>
      new Bree({
        root,
        jobs: [{ name: 'basic', cron: '* * * *' }]
      }),
    { message: /Job #.* named .* had an invalid cron pattern: */ }
  );
});

test('fails if closeWorkersAfterMs is <= 0 or infinite', (t) => {
  t.throws(
    () =>
      new Bree({
        root,
        jobs: [{ name: 'basic', closeWorkerAfterMs: 0 }]
      }),
    {
      message: /Job #.* named .* had an invalid closeWorkersAfterMs value of */
    }
  );
});

test('fails if reserved job name: index, index.js, index.mjs', (t) => {
  t.throws(
    () =>
      new Bree({
        root,
        jobs: [{ name: 'index' }]
      }),
    {
      message:
        'You cannot use the reserved job name of "index", "index.js", nor "index.mjs"'
    }
  );
});

test('getHumanToMs()', (t) => {
  const bree = new Bree({
    root,
    jobs: ['basic']
  });

  t.is(bree.getHumanToMs('one second'), 1000);
  t.is(bree.getHumanToMs('1s'), 1000);
});

test('parseValue()', (t) => {
  const bree = new Bree({
    root,
    jobs: ['basic']
  });

  // if value is false
  t.is(bree.parseValue(false), false);

  // if value is schedule
  const schedule = { schedules: [] };
  t.is(bree.parseValue(schedule), schedule);

  // if value is a string
  t.snapshot(bree.parseValue('at 12:00 pm'));
  t.is(bree.parseValue('1 second'), 1000);

  // if value is finite or < 0
  t.throws(() => bree.parseValue(-1), {
    message: /Value .* must be a finite number */
  });

  // if value is none of the above
  t.is(bree.parseValue(1), 1);
});

test('isSchedule()', (t) => {
  const bree = new Bree({
    root,
    jobs: ['basic']
  });

  t.is(bree.isSchedule({}), false);
  t.is(bree.isSchedule({ schedules: null }), false);
  t.is(bree.isSchedule({ schedules: [] }), true);
});

test('getWorkerMetadata()', (t) => {
  const bree = new Bree({
    root,
    jobs: ['basic']
  });

  t.throws(() => bree.getWorkerMetadata('leroy'), {
    message: 'Job "leroy" does not exist'
  });

  t.is(bree.getWorkerMetadata('basic'), undefined);

  bree.config.outputWorkerMetadata = true;
  bree.config.jobs[0].outputWorkerMetadata = true;
  t.snapshot(bree.getWorkerMetadata('basic'));
});

test('run > job does not exist', (t) => {
  const bree = new Bree({
    root,
    jobs: ['basic']
  });

  t.throws(() => bree.run('leroy'), {
    message: 'Job "leroy" does not exist'
  });
});

test('run > job already running', (t) => {
  const logger = _.cloneDeep(console);
  logger.error = (err, _) => {
    t.is(err.message, 'Job "basic" is already running');
  };

  logger.info = () => {};

  const bree = new Bree({
    root,
    jobs: ['basic'],
    logger
  });

  bree.run('basic');
  bree.run('basic');
});

test.serial('run > job terminates after set time', async (t) => {
  // this test may fail sometimes due to timing issues.
  const logger = _.cloneDeep(console);
  logger.info = () => {};
  logger.error = () => {};

  const bree = new Bree({
    root,
    jobs: [{ name: 'infinite', closeWorkerAfterMs: 1000 }],
    logger
  });

  const clock = FakeTimers.install({ now: Date.now() });

  bree.run('infinite');
  t.true(typeof bree.closeWorkerAfterMs.infinite === 'object');

  // eslint-disable-next-line no-new
  new Promise((resolve, reject) => {
    bree.workers.infinite.on('error', reject);
    bree.workers.infinite.on('exit', (code) => {
      t.true(code === 1);
      resolve();
    });
  });
  await clock.nextAsync();

  clock.uninstall();
});

test('run > job terminates on message "done"', async (t) => {
  const logger = _.cloneDeep(console);
  logger.info = () => {};

  const bree = new Bree({
    root,
    jobs: [{ name: 'done' }],
    logger
  });

  bree.run('done');
  t.is(typeof bree.workers.done, 'object');

  await new Promise((resolve, reject) => {
    bree.workers.done.on('error', reject);
    bree.workers.done.on('message', (message) => {
      if (message === 'get ready') {
        resolve();
      }
    });
  });

  await delay(1);
  t.is(typeof bree.workers.done, 'undefined');
});

test('run > job sent a message', async (t) => {
  const logger = _.cloneDeep(console);
  logger.info = (message) => {
    if (message === 'Worker for job "message" sent a message') t.pass();
  };

  const bree = new Bree({
    root,
    jobs: [{ name: 'message' }],
    logger
  });

  bree.run('message');

  bree.workers.message.postMessage('test');

  await new Promise((resolve, reject) => {
    bree.workers.message.on('error', reject);
    bree.workers.message.on('exit', resolve);
  });
});

test('run > job sent an error', async (t) => {
  const logger = {
    error: (message) => {
      if (message === 'Worker for job "message" had an error') t.pass();
    },
    info: () => {}
  };

  const bree = new Bree({
    root,
    jobs: [{ name: 'message' }],
    logger
  });

  bree.run('message');

  bree.workers.message.postMessage('error');

  await new Promise((resolve) => {
    bree.workers.message.on('error', resolve);
    bree.workers.message.on('exit', resolve);
  });
});

test('run > jobs run all when no name designated', async (t) => {
  const logger = _.cloneDeep(console);
  logger.info = () => {};

  const bree = new Bree({
    root,
    jobs: ['basic'],
    logger
  });

  bree.run();
  await delay(1);

  t.true(typeof bree.workers.basic === 'object');

  await new Promise((resolve, reject) => {
    bree.workers.basic.on('error', reject);
    bree.workers.basic.on('exit', (code) => {
      t.is(code, 0);
      resolve();
    });
  });

  t.true(typeof bree.workers.basic === 'undefined');
});

test('start > throws error if job does not exist', (t) => {
  const bree = new Bree({
    root,
    jobs: ['basic']
  });

  t.throws(() => bree.start('leroy'), { message: 'Job leroy does not exist' });
});

test('start > fails if job already started', async (t) => {
  const logger = _.cloneDeep(console);
  logger.error = (err) => {
    t.is(err.message, 'Job "short" is already started');
  };

  const bree = new Bree({
    root,
    jobs: ['short'],
    logger
  });

  bree.start('short');
  await delay(1);
  bree.start('short');

  bree.stop();
});

test('start > fails if date is in the past', async (t) => {
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', date: new Date() }]
  });

  await delay(1);

  bree.start('basic');

  t.is(typeof bree.timeouts.basic, 'undefined');

  bree.stop();
});

test.serial('start > sets timeout if date is in the future', async (t) => {
  const bree = new Bree({
    root,
    jobs: [
      {
        name: 'infinite',
        date: new Date(Date.now() + 10)
      }
    ]
  });

  const clock = FakeTimers.install({ now: Date.now() });

  t.is(typeof bree.timeouts.infinite, 'undefined');

  bree.start('infinite');
  await clock.nextAsync();

  t.is(typeof bree.timeouts.infinite, 'object');

  bree.stop();
  clock.uninstall();
});

test.serial(
  'start > sets interval if date is in the future and interval is schedule',
  async (t) => {
    t.plan(3);

    const bree = new Bree({
      root,
      jobs: [
        {
          name: 'infinite',
          date: new Date(Date.now() + 10),
          interval: later.parse.cron('* * * * *')
        }
      ]
    });

    const clock = FakeTimers.install({ now: Date.now() });

    t.is(typeof bree.intervals.infinite, 'undefined');

    bree.start('infinite');
    await clock.nextAsync();

    t.is(typeof bree.intervals.infinite, 'object');

    const promise = new Promise((resolve, reject) => {
      bree.workers.infinite.on('error', reject);
      bree.workers.infinite.on('exit', (code) => {
        t.true(code === 0);
        resolve();
      });
    });
    clock.next();
    await promise;

    bree.stop();
    clock.uninstall();
  }
);

test.serial(
  'start > sets interval if date is in the future and interval is number',
  async (t) => {
    t.plan(3);

    const bree = new Bree({
      root,
      jobs: [
        {
          name: 'infinite',
          date: new Date(Date.now() + 10),
          interval: 100000
        }
      ]
    });

    const clock = FakeTimers.install({ now: Date.now() });

    t.is(typeof bree.intervals.infinite, 'undefined');

    bree.start('infinite');
    await clock.nextAsync();

    t.is(typeof bree.intervals.infinite, 'object');

    const promise = new Promise((resolve, reject) => {
      bree.workers.infinite.on('error', reject);
      bree.workers.infinite.on('exit', (code) => {
        t.true(code === 0);
        resolve();
      });
    });
    clock.next();
    await promise;

    bree.stop();
    clock.uninstall();
  }
);

test.serial(
  'start > sets timeout if interval is schedule and timeout is schedule',
  async (t) => {
    t.plan(6);

    const bree = new Bree({
      root,
      jobs: [
        {
          name: 'infinite',
          timeout: later.parse.cron('* * * * *'),
          interval: later.parse.cron('* * * * *')
        }
      ]
    });

    const clock = FakeTimers.install({ now: Date.now() });

    t.is(typeof bree.timeouts.infinite, 'undefined');
    t.is(typeof bree.intervals.infinite, 'undefined');

    bree.start('infinite');

    t.is(typeof bree.timeouts.infinite, 'object');

    await clock.nextAsync();
    t.is(typeof bree.intervals.infinite, 'object');
    t.is(typeof bree.timeouts.infinie, 'undefined');

    const promise = new Promise((resolve, reject) => {
      bree.workers.infinite.on('error', reject);
      bree.workers.infinite.on('exit', (code) => {
        t.true(code === 0);
        resolve();
      });
    });
    clock.next();
    await promise;

    bree.stop();
    clock.uninstall();
  }
);

test.serial(
  'start > sets timeout if interval is number and timeout is schedule',
  async (t) => {
    t.plan(6);

    const bree = new Bree({
      root,
      jobs: [
        {
          name: 'infinite',
          timeout: later.parse.cron('* * * * *'),
          interval: 1000
        }
      ]
    });

    const clock = FakeTimers.install({ now: Date.now() });

    t.is(typeof bree.timeouts.infinite, 'undefined');
    t.is(typeof bree.intervals.infinite, 'undefined');

    bree.start('infinite');

    t.is(typeof bree.timeouts.infinite, 'object');

    await clock.nextAsync();
    t.is(typeof bree.intervals.infinite, 'object');
    t.is(typeof bree.timeouts.infinie, 'undefined');

    const promise = new Promise((resolve, reject) => {
      bree.workers.infinite.on('error', reject);
      bree.workers.infinite.on('exit', (code) => {
        t.true(code === 0);
        resolve();
      });
    });
    clock.next();
    await promise;

    bree.stop();
    clock.uninstall();
  }
);

test.serial(
  'start > sets timeout if interval is schedule and timeout is number',
  async (t) => {
    t.plan(6);

    const bree = new Bree({
      root,
      jobs: [
        {
          name: 'infinite',
          timeout: 1000,
          interval: later.parse.cron('* * * * *')
        }
      ]
    });

    const clock = FakeTimers.install({ now: Date.now() });

    t.is(typeof bree.timeouts.infinite, 'undefined');
    t.is(typeof bree.intervals.infinite, 'undefined');

    bree.start('infinite');

    t.is(typeof bree.timeouts.infinite, 'object');

    await clock.nextAsync();
    t.is(typeof bree.intervals.infinite, 'object');
    t.is(typeof bree.timeouts.infinie, 'undefined');

    const promise = new Promise((resolve, reject) => {
      bree.workers.infinite.on('error', reject);
      bree.workers.infinite.on('exit', (code) => {
        t.true(code === 0);
        resolve();
      });
    });
    clock.next();
    await promise;

    bree.stop();
    clock.uninstall();
  }
);

test.serial(
  'start > sets timeout if interval is number and timeout is number',
  async (t) => {
    t.plan(6);

    const bree = new Bree({
      root,
      jobs: [
        {
          name: 'infinite',
          timeout: 1000,
          interval: 1000
        }
      ]
    });

    const clock = FakeTimers.install({ now: Date.now() });

    t.is(typeof bree.timeouts.infinite, 'undefined');
    t.is(typeof bree.intervals.infinite, 'undefined');

    bree.start('infinite');

    t.is(typeof bree.timeouts.infinite, 'object');

    await clock.nextAsync();
    t.is(typeof bree.intervals.infinite, 'object');
    t.is(typeof bree.timeouts.infinie, 'undefined');

    const promise = new Promise((resolve, reject) => {
      bree.workers.infinite.on('error', reject);
      bree.workers.infinite.on('exit', (code) => {
        t.true(code === 0);
        resolve();
      });
    });
    clock.next();
    await promise;

    bree.stop();
    clock.uninstall();
  }
);

test.serial('start > sets interval if interval is schedule', async (t) => {
  t.plan(3);

  const bree = new Bree({
    root,
    jobs: ['infinite'],
    timeout: false,
    interval: later.parse.cron('* * * * *')
  });

  const clock = FakeTimers.install({ now: Date.now() });

  t.is(typeof bree.intervals.infinite, 'undefined');

  bree.start('infinite');

  t.is(typeof bree.intervals.infinite, 'object');

  await clock.nextAsync();
  const promise = new Promise((resolve, reject) => {
    bree.workers.infinite.on('error', reject);
    bree.workers.infinite.on('exit', (code) => {
      t.true(code === 0);
      resolve();
    });
  });
  clock.next();
  await promise;

  bree.stop();
  clock.uninstall();
});

test.serial('start > sets interval if interval is number', async (t) => {
  t.plan(3);

  const bree = new Bree({
    root,
    jobs: ['infinite'],
    timeout: false,
    interval: 1000
  });

  const clock = FakeTimers.install({ now: Date.now() });

  t.is(typeof bree.intervals.infinite, 'undefined');

  bree.start('infinite');

  t.is(typeof bree.intervals.infinite, 'object');

  await clock.nextAsync();
  const promise = new Promise((resolve, reject) => {
    bree.workers.infinite.on('error', reject);
    bree.workers.infinite.on('exit', (code) => {
      t.true(code === 0);
      resolve();
    });
  });
  clock.next();
  await promise;

  bree.stop();
  clock.uninstall();
});

test.serial('stop > job stops when "cancel" message is sent', async (t) => {
  t.plan(4);

  const logger = _.cloneDeep(console);
  logger.info = (message) => {
    if (message === 'Gracefully cancelled worker for job "message"')
      t.true(true);
  };

  const bree = new Bree({
    root,
    jobs: [{ name: 'message' }],
    logger
  });

  t.is(typeof bree.workers.message, 'undefined');

  bree.start('message');
  await delay(1);

  t.is(typeof bree.workers.message, 'object');

  bree.stop();
  await delay(500);

  t.is(typeof bree.workers.message, 'undefined');
});

test('stop > clears closeWorkerAfterMs', async (t) => {
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic', closeWorkerAfterMs: 10 }]
  });

  t.is(typeof bree.closeWorkerAfterMs.basic, 'undefined');

  bree.start('basic');
  await delay(1);

  t.is(typeof bree.closeWorkerAfterMs.basic, 'object');

  bree.stop('basic');

  t.is(typeof bree.closeWorkerAfterMs.basic, 'undefined');
});

test('does not throw an error when root directory option is set to false', (t) => {
  t.notThrows(
    () =>
      new Bree({
        root: false,
        jobs: [{ name: 'basic', path: path.join(__dirname, 'jobs/basic.js') }]
      })
  );
});

test('job with custom worker instance options', (t) => {
  t.notThrows(
    () =>
      new Bree({
        root,
        jobs: [{ name: 'basic', worker: { argv: ['test'] } }]
      })
  );
});

test('job that combines date and cron', (t) => {
  t.notThrows(
    () =>
      new Bree({
        root,
        jobs: ['basic'],
        date: new Date(Date.now() + 100),
        cron: '* * * * *'
      })
  );
});

test('job that combines timeout and cron', (t) => {
  t.notThrows(
    () =>
      new Bree({
        root,
        jobs: ['basic'],
        timeout: 100,
        cron: '* * * * *'
      })
  );
});

test('set default interval', (t) => {
  const bree = new Bree({
    root,
    jobs: [{ name: 'basic' }],
    interval: 100
  });
  t.is(bree.config.jobs[0].interval, 100);
});

test('emits "worker created" and "worker started" events', async (t) => {
  const bree = new Bree({
    root,
    jobs: ['basic'],
    timeout: 100
  });
  let created;
  let deleted;
  bree.start();
  bree.on('worker created', (name) => {
    t.log('worker created', name);
    t.true(typeof bree.workers[name] === 'object');
    created = true;
  });
  bree.on('worker deleted', (name) => {
    t.log('worker deleted', name);
    t.true(typeof bree.workers[name] === 'undefined');
    deleted = true;
  });
  await delay(3000);
  t.true(created && deleted);
});

test.todo(
  'job new Bree({ jobs: ["test.js", "test.mjs"] }) with defined extension in top level Array'
);
test.todo('job name ends with js, mjs, and none to use default');
test.todo('job with custom hasSeconds option passed');

// TODO: there are a bunch of uncovered line numbers
// `yarn run test-coverage` to see
// once you can increase this, then we can increase "branches" threshold
// in the root dir file named `.nycrc`
