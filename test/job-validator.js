const path = require('path');
const test = require('ava');
const later = require('@breejs/later');

const jobValidator = require('../src/job-validator');

const root = path.join(__dirname, 'jobs');

const baseConfig = {
  root,
  defaultExtension: 'js',
  acceptedExtensions: ['.js', '.mjs']
};

test('does not throw for valid object job', async (t) => {
  await t.notThrowsAsync(
    jobValidator({ name: 'basic' }, 0, ['exists'], baseConfig)
  );
});

test('does not throw for valid object job with extension on name', async (t) => {
  await t.notThrowsAsync(
    jobValidator({ name: 'basic.js' }, 0, ['exists'], baseConfig)
  );
});

test('does not throw for valid string job', async (t) => {
  await t.notThrowsAsync(jobValidator('basic', 1, ['exists'], baseConfig));
});

test('does not throw for valid string job with extension', async (t) => {
  await t.notThrowsAsync(jobValidator('basic.js', 1, ['exists'], baseConfig));
});

test('throws for non-unique job name', async (t) => {
  const err = await t.throwsAsync(
    jobValidator(
      {
        name: 'exists'
      },
      0,
      ['exists'],
      {
        root: false
      }
    )
  );
  t.regex(err.message, /Job #1 has a duplicate job name of exists/);
});

test('constructs default cronValidate configuration', (t) => {
  const returned = jobValidator.cronValidateWithSeconds({ name: 'hello' }, {});

  const expected = {
    override: {
      useSeconds: true
    },
    preset: 'default'
  };

  t.deepEqual(returned, expected);
});

// TODO: this can be improved
test("prefers job's cronValidate configuration with validateCron", (t) => {
  const job = {
    hasSeconds: false,
    cronValidate: {
      preset: 'custom'
    }
  };
  const config = {
    cronValidate: {
      preset: 'global'
    }
  };

  const returned = jobValidator.validateCron(job, 'Test prefix', config);

  const expected = [
    new Error(
      'Test prefix had an invalid cron pattern: Option preset custom does not exist.'
    )
  ];

  t.deepEqual(returned, expected);
});

test("prefers job's cronValidate configuration", (t) => {
  const job = {
    cronValidate: {
      preset: 'custom'
    }
  };
  const config = {
    cronValidate: {
      preset: 'global'
    }
  };

  const returned = jobValidator.cronValidateWithSeconds(job, config);

  const expected = {
    override: {
      useSeconds: true
    },
    preset: 'custom'
  };

  t.deepEqual(returned, expected);
});

test("prefers config's cronValidate if none in job configuration", (t) => {
  const job = {};

  const config = {
    cronValidate: {
      preset: 'config-preset'
    }
  };

  const returned = jobValidator.cronValidateWithSeconds(job, config);

  const expected = {
    override: {
      useSeconds: true
    },
    preset: 'config-preset'
  };

  t.deepEqual(returned, expected);
});

test("uses confg's override cronValidate if none in job configuration", (t) => {
  const job = {};

  const config = {
    cronValidate: {
      override: {
        useSeconds: true
      }
    }
  };

  const returned = jobValidator.cronValidateWithSeconds(job, config);

  const expected = {
    override: {
      useSeconds: true
    },
    preset: 'default'
  };

  t.deepEqual(returned, expected);
});

test("prefers job's override cronValidate if none in job configuration", (t) => {
  const job = {
    cronValidate: {
      override: {
        useSeconds: true
      }
    }
  };

  const config = {
    cronValidate: {
      override: {
        useSeconds: false
      }
    }
  };

  const returned = jobValidator.cronValidateWithSeconds(job, config);

  const expected = {
    override: {
      useSeconds: true
    },
    preset: 'default'
  };

  t.deepEqual(returned, expected);
});

test('throws for reserved job.name', async (t) => {
  const err = await t.throwsAsync(
    jobValidator({ name: 'index' }, 0, ['exists'], baseConfig)
  );
  t.is(
    err.message,
    'You cannot use the reserved job name of "index", "index.js", nor "index.mjs"'
  );
});

test('throws for reserved job name', async (t) => {
  const err = await t.throwsAsync(
    jobValidator('index', 0, ['exists'], baseConfig)
  );
  t.is(
    err.message,
    'You cannot use the reserved job name of "index", "index.js", nor "index.mjs"'
  );
});

test('throws for string job if no root directory', async (t) => {
  const err = await t.throwsAsync(
    jobValidator('basic', 0, ['exists'], {
      defaultExtension: 'js'
    })
  );
  t.is(
    err.message,
    'Job #1 "basic" requires root directory option to auto-populate path'
  );
});

test('throws for object job if no root directory', async (t) => {
  const err = await t.throwsAsync(
    jobValidator({ name: 'basic' }, 0, ['exists'], {
      defaultExtension: 'js'
    })
  );
  t.is(
    err.message,
    'Job #1 named "basic" requires root directory option to auto-populate path'
  );
});

test('does not throw for valid job path', (t) => {
  t.notThrows(() =>
    jobValidator(
      { name: 'basic', path: root + '/basic.js' },
      0,
      ['exists'],
      baseConfig
    )
  );
});

test('does not throw for path without extension', (t) => {
  t.notThrows(() => jobValidator({ name: 'basic' }, 0, ['exists'], baseConfig));
});

test('does not throw for valid function', (t) => {
  const fn = () => {
    return true;
  };

  t.notThrows(() => jobValidator(fn, 1, ['exists'], baseConfig));
});

test('throws for bound function', async (t) => {
  const fn = () => {
    return true;
  };

  const boundFn = fn.bind(this);

  const err = await t.throwsAsync(
    jobValidator(boundFn, 1, ['exists'], baseConfig)
  );
  t.is(err.message, "Job #2 can't be a bound or built-in function");
});

test('does not throw for valid function in job.path', async (t) => {
  const fn = () => {
    return true;
  };

  await t.notThrowsAsync(
    jobValidator({ path: fn, name: 'fn' }, 1, ['exists'], baseConfig)
  );
});

test('throws for bound function in job.path', async (t) => {
  const fn = () => {
    return true;
  };

  const boundFn = fn.bind(this);

  const err = await t.throwsAsync(
    jobValidator({ path: boundFn, name: 'fn' }, 1, ['exists'], baseConfig)
  );
  t.is(err.message, 'Job #2 named "fn" can\'t be a bound or built-in function');
});

test('does not throw for valid cron without seconds', async (t) => {
  await t.notThrowsAsync(
    jobValidator(
      { name: 'basic', cron: '* * * * *' },
      0,
      ['exists'],
      baseConfig
    )
  );
});

test('does not throw for valid cron with "L" in day', async (t) => {
  await t.notThrowsAsync(
    jobValidator({ name: 'basic', cron: '* * L * *' }, 0, ['exists'], {
      root,
      defaultExtension: 'js',
      acceptedExtensions: ['.js', '.mjs'],
      cronValidate: {
        override: {
          useLastDayOfMonth: true
        }
      }
    })
  );
});

test('does not throw for valid cron with seconds', async (t) => {
  await t.notThrowsAsync(
    jobValidator(
      { name: 'basic', cron: '* * * * * *', hasSeconds: true },
      0,
      ['exists'],
      baseConfig
    )
  );
});

test('does not throw for valid cron that is a schedule', async (t) => {
  await t.notThrowsAsync(
    jobValidator(
      { name: 'basic', cron: later.parse.cron('* * * * *') },
      0,
      ['exists'],
      baseConfig
    )
  );
});

test('throws for invalid cron expression', async (t) => {
  const err = await t.throwsAsync(
    jobValidator(
      { name: 'basic', cron: '* * * * * *' },
      0,
      ['exists'],
      baseConfig
    )
  );
  t.is(
    err.message,
    'Job #1 named "basic" had an invalid cron pattern: Expected 5 values, but got 6. (Input cron: \'* * * * * *\')'
  );
});

test('throws if no no name exists', async (t) => {
  const err = await t.throwsAsync(jobValidator({}, 0, ['exists'], baseConfig));
  t.is(err.message, 'Job #1 is missing a name');
});

test('throws if both interval and cron are used', async (t) => {
  const err = await t.throwsAsync(
    jobValidator(
      { name: 'basic', cron: '* * * * *', interval: 60 },
      0,
      ['exists'],
      baseConfig
    )
  );
  t.is(
    err.message,
    'Job #1 named "basic" cannot have both interval and cron configuration'
  );
});

test('throws if both timeout and date are used', async (t) => {
  const err = await t.throwsAsync(
    jobValidator(
      { name: 'basic', timeout: 60, date: new Date('12/30/2020') },
      0,
      ['exists'],
      baseConfig
    )
  );
  t.is(err.message, 'Job #1 named "basic" cannot have both timeout and date');
});

test('throws if date is not a Date object', async (t) => {
  const err = await t.throwsAsync(
    jobValidator(
      { name: 'basic', date: '12/23/2020' },
      0,
      ['exists'],
      baseConfig
    )
  );
  t.is(err.message, 'Job #1 named "basic" had an invalid Date of 12/23/2020');
});

test('throws if timeout is invalid', async (t) => {
  const err = await t.throwsAsync(
    jobValidator({ name: 'basic', timeout: -1 }, 0, ['exists'], baseConfig)
  );
  t.regex(err.message, /Job #1 named "basic" had an invalid timeout of -1; */);
});

test('throws if interval is invalid', async (t) => {
  const err = await t.throwsAsync(
    jobValidator({ name: 'basic', interval: -1 }, 0, ['exists'], baseConfig)
  );
  t.regex(
    err.message,
    /Job #1 named "basic" had an invalid interval of undefined; */
  );
});

test('throws if hasSeconds is not a boolean', async (t) => {
  const err = await t.throwsAsync(
    jobValidator(
      { name: 'basic', hasSeconds: 'test' },
      0,
      ['exists'],
      baseConfig
    )
  );
  t.is(
    err.message,
    'Job #1 named "basic" had hasSeconds value of test (it must be a Boolean)'
  );
});

test('throws if cronValidate is not an Object', async (t) => {
  const err = await t.throwsAsync(
    jobValidator(
      { name: 'basic', cronValidate: 'test' },
      0,
      ['exists'],
      baseConfig
    )
  );
  t.is(
    err.message,
    'Job #1 named "basic" had cronValidate value set, but it must be an Object'
  );
});

test('throws if closeWorkerAfterMs is invalid', async (t) => {
  const err = await t.throwsAsync(
    jobValidator(
      { name: 'basic', closeWorkerAfterMs: -1 },
      0,
      ['exists'],
      baseConfig
    )
  );
  t.is(
    err.message,
    'Job #1 named "basic" had an invalid closeWorkersAfterMs value of undefined (it must be a finite number > 0)'
  );
});

test('succeeds if job.timezone is valid', async (t) => {
  await t.notThrowsAsync(
    jobValidator(
      { name: 'basic', timezone: 'America/New_York' },
      0,
      ['exists'],
      baseConfig
    )
  );
});

test('accepts "local" and "system" as valid job.timezone options', async (t) => {
  await t.notThrowsAsync(
    jobValidator(
      { name: 'basic', timezone: 'local' },
      0,
      ['exists'],
      baseConfig
    )
  );
  await t.notThrowsAsync(
    jobValidator(
      { name: 'basic', timezone: 'system' },
      0,
      ['exists'],
      baseConfig
    )
  );
});

test('throws if job.timezone is invalid or unsupported', async (t) => {
  const err = await t.throwsAsync(
    jobValidator(
      { name: 'basic', timezone: 'bogus' },
      0,
      ['exists'],
      baseConfig
    )
  );
  t.is(
    err.message,
    'Job #1 named "basic" had an invalid or unsupported timezone specified: bogus'
  );
});

test('throws if path is not a file during object job', async (t) => {
  const err = await t.throwsAsync(
    jobValidator({ name: 'leroy.js' }, 0, ['exists'], baseConfig)
  );
  t.regex(err.message, /path missing/);
});

test('throws if path is not a file during string job', async (t) => {
  const err = await t.throwsAsync(
    jobValidator('leroy.js', 0, ['exists'], baseConfig)
  );
  t.regex(err.message, /path missing/);
});
