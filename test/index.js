const path = require('path');
const { once } = require('events');

const test = require('ava');

const delay = require('delay');
const humanInterval = require('human-interval');
const FakeTimers = require('@sinonjs/fake-timers');

const Bree = require('../src');

const root = path.join(__dirname, 'jobs');
const baseConfig = {
  root,
  timeout: 0,
  interval: 0,
  hasSeconds: false,
  defaultExtension: 'js'
};

test('successfully run job', async (t) => {
  t.plan(2);

  const logger = {
    info() {}
  };

  const bree = new Bree({
    jobs: ['infinite'],
    ...baseConfig,
    logger
  });

  await bree.start();

  bree.on('worker created', (name) => {
    t.true(bree.workers.has(name));
  });

  bree.on('worker deleted', (name) => {
    t.false(bree.workers.has(name));
  });

  await delay(100);

  await bree.stop();
});

test('preset and override is set if config.hasSeconds is "true"', (t) => {
  const bree = new Bree({
    jobs: ['basic'],
    ...baseConfig,
    hasSeconds: true
  });

  t.is(bree.config.cronValidate.preset, 'default');
  t.true(typeof bree.config.cronValidate.override === 'object');
});

test('preset and override is set by cronValidate config', (t) => {
  const bree = new Bree({
    jobs: ['basic'],
    ...baseConfig,
    hasSeconds: true,
    cronValidate: {
      preset: 'test',
      override: { test: 'works' }
    }
  });

  t.is(bree.config.cronValidate.preset, 'test');
  t.true(typeof bree.config.cronValidate.override === 'object');
  t.is(bree.config.cronValidate.override.test, 'works');
});

test('throws if jobs is not an array and logs ERR_MODULE_NOT_FOUND error by default', async (t) => {
  t.plan(3);

  const logger = {
    info() {},
    error(err) {
      t.is(err.code, 'ERR_MODULE_NOT_FOUND');
    }
  };

  const bree = new Bree({
    jobs: null,
    ...baseConfig,
    logger,
    root: path.join(__dirname, 'noIndexJobs')
  });
  const err = await t.throwsAsync(bree.init());
  t.is(err.message, 'Jobs must be an Array');
});

test('logs ERR_MODULE_NOT_FOUND error if array is empty', async (t) => {
  t.plan(2);

  const logger = {
    info() {},
    error(err) {
      t.is(err.code, 'ERR_MODULE_NOT_FOUND');
    }
  };

  const bree = new Bree({
    jobs: [],
    ...baseConfig,
    logger,
    root: path.join(__dirname, 'noIndexJobs')
  });

  await bree.init();

  t.true(bree instanceof Bree);
});

test('does not log ERR_MODULE_NOT_FOUND error if silenceRootCheckError is false', async (t) => {
  const logger = {
    info() {},
    error() {
      t.fail();
    }
  };

  const bree = new Bree({
    jobs: [],
    ...baseConfig,
    logger,
    root: path.join(__dirname, 'noIndexJobs'),
    silenceRootCheckError: true
  });

  await bree.init();

  t.true(bree instanceof Bree);
});

test('does not log ERR_MODULE_NOT_FOUND error if doRootCheck is false', async (t) => {
  const logger = {
    info() {},
    error() {
      t.fail();
    }
  };

  const bree = new Bree({
    jobs: [],
    ...baseConfig,
    logger,
    root: path.join(__dirname, 'noIndexJobs'),
    doRootCheck: false
  });

  await bree.init();

  t.true(bree instanceof Bree);
});

test('throws during constructor if job-validator throws', async (t) => {
  const bree = new Bree({
    jobs: [{ name: 'basic', hasSeconds: 'test' }],
    ...baseConfig
  });
  const err = await t.throwsAsync(bree.init());
  t.is(
    err.message,
    'Job #1 named "basic" had hasSeconds value of test (it must be a Boolean)'
  );
});

test('emits "worker created" and "worker started" events', async (t) => {
  t.plan(2);

  const bree = new Bree({
    root,
    jobs: ['basic'],
    timeout: 100
  });

  await bree.start();

  bree.on('worker created', (name) => {
    t.true(bree.workers.has(name));
  });
  bree.on('worker deleted', (name) => {
    t.false(bree.workers.has(name));
  });

  await delay(1000);

  await bree.stop();
});

test.serial('job with long timeout runs', async (t) => {
  t.plan(2);

  const bree = new Bree({
    root,
    jobs: ['infinite'],
    timeout: '3 months'
  });

  await bree.init();
  t.is(bree.config.jobs[0].timeout, humanInterval('3 months'));

  const now = Date.now();
  const clock = FakeTimers.install({ now: Date.now() });

  await bree.start('infinite');
  bree.on('worker created', () => {
    // Only complicated because of runtime - this removes flakiness
    t.true(
      clock.now - now === humanInterval('3 months') ||
        clock.now - now === humanInterval('3 months') + 1
    );
  });
  // Should run till worker stops running
  clock.runAll();

  clock.uninstall();
});

test.serial(
  'job created with cron string is using local timezone',
  async (t) => {
    t.plan(2);
    const bree = new Bree({
      root,
      jobs: [{ name: 'basic', cron: '0 18 * * *' }]
    });

    const clock = FakeTimers.install({ now: Date.now() });
    await bree.start('basic');
    bree.on('worker created', () => {
      const now = new Date(clock.now);
      const offsetOfLocalDates = new Date().getTimezoneOffset();

      t.is(now.getTimezoneOffset(), offsetOfLocalDates);
      t.is(now.getHours(), 18);
    });
    clock.next();
    clock.uninstall();
  }
);

test.serial(
  'job created with human interval is using local timezone',
  async (t) => {
    t.plan(2);
    const bree = new Bree({
      root,
      jobs: [{ name: 'basic', interval: 'at 13:26' }]
    });

    const clock = FakeTimers.install({ now: Date.now() });
    await bree.start('basic');
    bree.on('worker created', () => {
      const now = new Date(clock.now);
      t.is(now.getHours(), 13);
      t.is(now.getMinutes(), 26);
    });
    clock.next();
    clock.uninstall();
  }
);

test('throws if acceptedExtensions is not an array', (t) => {
  const err = t.throws(
    () =>
      new Bree({
        jobs: ['basic'],
        ...baseConfig,
        acceptedExtensions: 'test string'
      })
  );
  t.is(err.message, '`acceptedExtensions` must be defined and an Array');
});

test('throws if acceptedExtensions is false', (t) => {
  const err = t.throws(
    () =>
      new Bree({
        jobs: ['basic'],
        ...baseConfig,
        acceptedExtensions: false
      })
  );
  t.is(err.message, '`acceptedExtensions` must be defined and an Array');
});

test('throws if root is not a directory', async (t) => {
  const bree = new Bree({
    jobs: ['basic'],
    ...baseConfig,
    root: path.resolve(__dirname, 'add.js')
  });
  const err = await t.throwsAsync(bree.init());
  t.regex(err.message, /Root directory of .+ does not exist/);
});

test('sets logger to noop if set to false', (t) => {
  const bree = new Bree({ root, logger: false });
  t.true(typeof bree.config.logger === 'object');
  t.true(typeof bree.config.logger.info === 'function');
  t.true(typeof bree.config.logger.warn === 'function');
  t.true(typeof bree.config.logger.error === 'function');
});

test('removes job on completion when config.removeCompleted is `true`', async (t) => {
  const bree = new Bree({
    jobs: ['basic'],
    ...baseConfig,
    logger: false,
    removeCompleted: true
  });

  await bree.run('basic');
  await once(bree.workers.get('basic'), 'exit');

  t.is(bree.config.jobs.length, 0);
});

test('ensures defaultExtension does not start with a period', (t) => {
  const err = t.throws(() => new Bree({ defaultExtension: '.js' }));
  t.is(
    err.message,
    '`defaultExtension` should not start with a ".", please enter the file extension without a leading period'
  );
});

test('handleJobCompletion throws if bree.init() was not called', (t) => {
  const bree = new Bree();
  const err = t.throws(() => bree.handleJobCompletion('foo'));
  t.is(
    err.message,
    'bree.init() was not called, see <https://github.com/breejs/bree/blob/master/UPGRADING.md#upgrading-from-v8-to-v9>'
  );
});

test('getWorkerMetadata throws if bree.init() was not called', (t) => {
  const bree = new Bree();
  const err = t.throws(() => bree.getWorkerMetadata());
  t.is(
    err.message,
    'bree.init() was not called, see <https://github.com/breejs/bree/blob/master/UPGRADING.md#upgrading-from-v8-to-v9>'
  );
});

test(`bree.init() is called if bree.remove() is called`, async (t) => {
  const bree = new Bree({ root, jobs: ['basic'] });
  await bree.remove('basic');
  t.true(bree._init);
});

test(`bree.init() is called if bree.stop() is called`, async (t) => {
  const bree = new Bree({ root, jobs: ['basic'] });
  await bree.stop('basic');
  t.true(bree._init);
});

test(`bree.init() is called if bree.add() is called`, async (t) => {
  const bree = new Bree({ root, jobs: ['basic'] });
  await bree.add('short');
  t.true(bree._init);
  await bree.add('message');
  t.true(bree._init);
});
