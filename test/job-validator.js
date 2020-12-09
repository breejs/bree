const test = require('ava');
const path = require('path');

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

test('does not throw for valid string job', (t) => {
  t.notThrows(() =>
    jobValidator('basic', 1, ['exists'], {
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
