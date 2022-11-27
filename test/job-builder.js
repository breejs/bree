const path = require('path');
const test = require('ava');
const later = require('@breejs/later');

const jobBuilder = require('../src/job-builder');

const root = path.join(__dirname, 'jobs');
const jobPathBasic = path.join(root, 'basic.js');

const baseConfig = {
  root,
  timeout: 0,
  interval: 0,
  hasSeconds: false,
  defaultExtension: 'js',
  acceptedExtensions: ['.js', '.mjs']
};

function job(t, _job, config, expected) {
  t.deepEqual(
    jobBuilder(_job ? _job : 'basic', { ...baseConfig, ...config }),
    expected
  );
}

test(
  'job name as file name without extension',
  job,
  null,
  {},
  { name: 'basic', path: jobPathBasic, timeout: 0, interval: 0 }
);

test(
  'job name as file name with extension',
  job,
  'basic.js',
  {},
  {
    name: 'basic.js',
    path: jobPathBasic,
    timeout: 0,
    interval: 0
  }
);

function basic() {
  setTimeout(() => {
    console.log('hello');
  }, 100);
}

test(
  'job is function',
  job,
  basic,
  {},
  {
    name: 'basic',
    path: `(${basic.toString()})()`,
    worker: { eval: true },
    timeout: 0,
    interval: 0
  }
);

test(
  'job.path is function',
  job,
  { path: basic, worker: { test: 1 } },
  {},
  {
    path: `(${basic.toString()})()`,
    worker: { eval: true, test: 1 },
    timeout: 0
  }
);

test(
  'job.path is blank and name of job is defined without extension',
  job,
  { name: 'basic', path: '' },
  {},
  { name: 'basic', path: jobPathBasic, timeout: 0 }
);

test(
  'job.path is blank and name of job is defined with extension',
  job,
  { name: 'basic.js', path: '' },
  {},
  { name: 'basic.js', path: jobPathBasic, timeout: 0 }
);

test(
  'job.path is path to file',
  job,
  { path: jobPathBasic },
  {},
  { path: jobPathBasic, timeout: 0 }
);

test(
  'job.path is not a file path',
  job,
  { path: '*.js', worker: { test: 1 } },
  {},
  { path: '*.js', timeout: 0, worker: { eval: true, test: 1 } }
);

test(
  'job.timeout is value',
  job,
  { path: jobPathBasic, timeout: 10 },
  {},
  { path: jobPathBasic, timeout: 10 }
);

test(
  'job.interval is value',
  job,
  { path: jobPathBasic, interval: 10 },
  {},
  { path: jobPathBasic, interval: 10 }
);

test(
  'job.cron is value',
  job,
  { path: jobPathBasic, cron: '* * * * *' },
  {},
  {
    path: jobPathBasic,
    cron: '* * * * *',
    interval: later.parse.cron('* * * * *')
  }
);

test(
  'job.cron is value with hasSeconds config',
  job,
  { path: jobPathBasic, cron: '* * * * *', hasSeconds: false },
  {},
  {
    path: jobPathBasic,
    cron: '* * * * *',
    interval: later.parse.cron('* * * * *'),
    hasSeconds: false
  }
);

test(
  'job.cron is schedule',
  job,
  { path: jobPathBasic, cron: later.parse.cron('* * * * *') },
  {},
  {
    path: jobPathBasic,
    cron: later.parse.cron('* * * * *'),
    interval: later.parse.cron('* * * * *')
  }
);

test(
  'default interval is greater than  0',
  job,
  { name: 'basic', interval: undefined },
  { interval: 10 },
  { name: 'basic', path: jobPathBasic, timeout: 0, interval: 10 }
);

test(
  'job as file inherits timezone from config',
  job,
  'basic',
  { timezone: 'local' },
  {
    timezone: 'local',
    name: 'basic',
    path: jobPathBasic,
    timeout: 0,
    interval: 0
  }
);

test(
  'job as function inherits timezone from config',
  job,
  basic,
  { timezone: 'local' },
  {
    timezone: 'local',
    name: 'basic',
    path: `(${basic.toString()})()`,
    timeout: 0,
    interval: 0,
    worker: { eval: true }
  }
);

test(
  'job as object inherits timezone from config',
  job,
  { name: 'basic' },
  { timezone: 'local' },
  {
    timezone: 'local',
    name: 'basic',
    path: jobPathBasic,
    timeout: 0
  }
);

test(
  'job as object retains its own timezone',
  job,
  { name: 'basic', timezone: 'America/New_York' },
  { timezone: 'local' },
  {
    timezone: 'America/New_York',
    name: 'basic',
    path: jobPathBasic,
    timeout: 0
  }
);
