const test = require('ava');
const path = require('path');
const later = require('@breejs/later');

const jobValidator = require('../src/job-validator');
const root = path.join(__dirname, 'jobs');

test('does not throw for valid object job', (t) => {
  t.notThrows(() =>
    jobValidator({ name: 'basic' }, 0, ['exists'], {
      root,
      defaultExtension: 'js'
    })
  );
});

test('does not throw for valid object job with extension on name', (t) => {
  t.notThrows(() =>
    jobValidator({ name: 'basic.js' }, 0, ['exists'], {
      root,
      defaultExtension: 'js'
    })
  );
});

test('does not throw for valid string job', (t) => {
  t.notThrows(() =>
    jobValidator('basic', 1, ['exists'], {
      root,
      defaultExtension: 'js'
    })
  );
});

test('does not throw for valid string job with extension', (t) => {
  t.notThrows(() =>
    jobValidator('basic.js', 1, ['exists'], {
      root,
      defaultExtension: 'js'
    })
  );
});

test('throws for non-unique job name', (t) => {
  t.throws(
    () =>
      jobValidator(
        {
          name: 'exists'
        },
        0,
        ['exists'],
        {
          root: false
        }
      ),
    {
      message: /Job #1 has a duplicate job name of exists/
    }
  );
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

test("prefers confg's cronValidate if none in job configuration", (t) => {
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

test('throws for reserved job.name', (t) => {
  t.throws(
    () =>
      jobValidator({ name: 'index' }, 0, ['exists'], {
        root,
        defaultExtension: 'js'
      }),
    {
      message:
        'You cannot use the reserved job name of "index", "index.js", nor "index.mjs"'
    }
  );
});

test('throws for reserved job name', (t) => {
  t.throws(
    () =>
      jobValidator('index', 0, ['exists'], {
        root,
        defaultExtension: 'js'
      }),
    {
      message:
        'You cannot use the reserved job name of "index", "index.js", nor "index.mjs"'
    }
  );
});

test('throws for string job if no root directory', (t) => {
  t.throws(
    () =>
      jobValidator('basic', 0, ['exists'], {
        defaultExtension: 'js'
      }),
    {
      message:
        'Job #1 "basic" requires root directory option to auto-populate path'
    }
  );
});

test('throws for object job if no root directory', (t) => {
  t.throws(
    () =>
      jobValidator({ name: 'basic' }, 0, ['exists'], {
        defaultExtension: 'js'
      }),
    {
      message:
        'Job #1 named "basic" requires root directory option to auto-populate path'
    }
  );
});

test('does not throw for valid job path', (t) => {
  t.notThrows(() =>
    jobValidator({ name: 'basic', path: root + '/basic.js' }, 0, ['exists'], {
      root,
      defaultExtension: 'js'
    })
  );
});

test('does not throw for path without extension', (t) => {
  t.notThrows(() =>
    jobValidator({ name: 'basic' }, 0, ['exists'], {
      root,
      defaultExtension: 'js'
    })
  );
});

test('does not throw for valid function', (t) => {
  const fn = () => {
    return true;
  };

  t.notThrows(() =>
    jobValidator(fn, 1, ['exists'], {
      root,
      defaultExtension: 'js'
    })
  );
});

test('throws for bound function', (t) => {
  const fn = () => {
    return true;
  };

  const boundFn = fn.bind(this);

  t.throws(
    () =>
      jobValidator(boundFn, 1, ['exists'], {
        root,
        defaultExtension: 'js'
      }),
    {
      message: "Job #2 can't be a bound or built-in function"
    }
  );
});

test('does not throw for valid function in job.path', (t) => {
  const fn = () => {
    return true;
  };

  t.notThrows(() =>
    jobValidator({ path: fn, name: 'fn' }, 1, ['exists'], {
      root,
      defaultExtension: 'js'
    })
  );
});

test('throws for bound function in job.path', (t) => {
  const fn = () => {
    return true;
  };

  const boundFn = fn.bind(this);

  t.throws(
    () =>
      jobValidator({ path: boundFn, name: 'fn' }, 1, ['exists'], {
        root,
        defaultExtension: 'js'
      }),
    {
      message: 'Job #2 named "fn" can\'t be a bound or built-in function'
    }
  );
});

test('does not throw for valid cron without seconds', (t) => {
  t.notThrows(() =>
    jobValidator({ name: 'basic', cron: '* * * * *' }, 0, ['exists'], {
      root,
      defaultExtension: 'js'
    })
  );
});

test('does not throw for valid cron with seconds', (t) => {
  t.notThrows(() =>
    jobValidator(
      { name: 'basic', cron: '* * * * * *', hasSeconds: true },
      0,
      ['exists'],
      {
        root,
        defaultExtension: 'js'
      }
    )
  );
});

test('does not throw for valid cron that is a schedule', (t) => {
  t.notThrows(() =>
    jobValidator(
      { name: 'basic', cron: later.parse.cron('* * * * *') },
      0,
      ['exists'],
      {
        root,
        defaultExtension: 'js'
      }
    )
  );
});

test('throws for invalid cron expression', (t) => {
  t.throws(
    () =>
      jobValidator({ name: 'basic', cron: '* * * * * *' }, 0, ['exists'], {
        root,
        defaultExtension: 'js'
      }),
    {
      message:
        'Job #1 named "basic" had an invalid cron pattern: Expected 5 values, but got 6. (Input cron: \'* * * * * *\')'
    }
  );
});

test('throws if no no name exists', (t) => {
  t.throws(
    () =>
      jobValidator({}, 0, ['exists'], {
        root,
        defaultExtension: 'js'
      }),
    {
      message: 'Job #1 is missing a name'
    }
  );
});

test('throws if both interval and cron are used', (t) => {
  t.throws(
    () =>
      jobValidator(
        { name: 'basic', cron: '* * * * *', interval: 60 },
        0,
        ['exists'],
        { root, defaultExtension: 'js' }
      ),
    {
      message:
        'Job #1 named "basic" cannot have both interval and cron configuration'
    }
  );
});

test('throws if both timeout and date are used', (t) => {
  t.throws(
    () =>
      jobValidator(
        { name: 'basic', timeout: 60, date: new Date('12/30/2020') },
        0,
        ['exists'],
        { root, defaultExtension: 'js' }
      ),
    {
      message: 'Job #1 named "basic" cannot have both timeout and date'
    }
  );
});

test('throws if date is not a Date object', (t) => {
  t.throws(
    () =>
      jobValidator({ name: 'basic', date: '12/23/2020' }, 0, ['exists'], {
        root,
        defaultExtension: 'js'
      }),
    {
      message: 'Job #1 named "basic" had an invalid Date of 12/23/2020'
    }
  );
});

test('throws if timeout is invalid', (t) => {
  t.throws(
    () =>
      jobValidator({ name: 'basic', timeout: -1 }, 0, ['exists'], {
        root,
        defaultExtension: 'js'
      }),
    {
      message: /Job #1 named "basic" had an invalid timeout of -1; */
    }
  );
});

test('throws if interval is invalid', (t) => {
  t.throws(
    () =>
      jobValidator({ name: 'basic', interval: -1 }, 0, ['exists'], {
        root,
        defaultExtension: 'js'
      }),
    {
      message: /Job #1 named "basic" had an invalid interval of undefined; */
    }
  );
});

test('throws if hasSeconds is not a boolean', (t) => {
  t.throws(
    () =>
      jobValidator({ name: 'basic', hasSeconds: 'test' }, 0, ['exists'], {
        root,
        defaultExtension: 'js'
      }),
    {
      message:
        'Job #1 named "basic" had hasSeconds value of test (it must be a Boolean)'
    }
  );
});

test('throws if cronValidate is not an Object', (t) => {
  t.throws(
    () =>
      jobValidator({ name: 'basic', cronValidate: 'test' }, 0, ['exists'], {
        root,
        defaultExtension: 'js'
      }),
    {
      message:
        'Job #1 named "basic" had cronValidate value set, but it must be an Object'
    }
  );
});

test('throws if closeWorkerAfterMs is invalid', (t) => {
  t.throws(
    () =>
      jobValidator({ name: 'basic', closeWorkerAfterMs: -1 }, 0, ['exists'], {
        root,
        defaultExtension: 'js'
      }),
    {
      message:
        'Job #1 named "basic" had an invalid closeWorkersAfterMs value of undefined (it must be a finite number > 0)'
    }
  );
});

test('succeeds if job.timezone is valid', (t) => {
  t.notThrows(() =>
    jobValidator(
      { name: 'basic', timezone: 'America/New_York' },
      0,
      ['exists'],
      {
        root,
        defaultExtension: 'js'
      }
    )
  );
});

test('accepts "local" and "system" as valid job.timezone options', (t) => {
  t.notThrows(() =>
    jobValidator({ name: 'basic', timezone: 'local' }, 0, ['exists'], {
      root,
      defaultExtension: 'js'
    })
  );
  t.notThrows(() =>
    jobValidator({ name: 'basic', timezone: 'system' }, 0, ['exists'], {
      root,
      defaultExtension: 'js'
    })
  );
});

test('throws if job.timezone is invalid or unsupported', (t) => {
  t.throws(
    () =>
      jobValidator({ name: 'basic', timezone: 'bogus' }, 0, ['exists'], {
        root,
        defaultExtension: 'js'
      }),
    {
      message:
        'Job #1 named "basic" had an invalid or unsupported timezone specified: bogus'
    }
  );
});
