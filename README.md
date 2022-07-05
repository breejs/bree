<h1 align="center">
  <a href="https://jobscheduler.net"><img src="https://d1i8ikybhfrv4r.cloudfront.net/bree/bree.png" alt="bree" /></a>
</h1>
<div align="center">
  <a href="https://github.com/breejs/bree/actions/workflows/ci.yml"><img src="https://github.com/breejs/bree/actions/workflows/ci.yml/badge.svg" alt="build status" /></a>
  <a href="https://github.com/sindresorhus/xo"><img src="https://img.shields.io/badge/code_style-XO-5ed9c7.svg" alt="code style" /></a>
  <a href="https://github.com/prettier/prettier"><img src="https://img.shields.io/badge/styled_with-prettier-ff69b4.svg" alt="styled with prettier" /></a>
  <a href="https://lass.js.org"><img src="https://img.shields.io/badge/made_with-lass-95CC28.svg" alt="made with lass" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/breejs/bree.svg" alt="license" /></a>
  <a href="https://npm.im/bree"><img src="https://img.shields.io/npm/dt/bree.svg" alt="npm downloads" /></a>
</div>
<br />
<div align="center">
  Bree is the best job scheduler for <a href="https://nodejs.org">Node.js</a> and JavaScript with <a href="https://en.wikipedia.org/wiki/Cron">cron</a>, <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date">dates</a>, <a href="https://github.com/vercel/ms">ms</a>, <a href="https://github.com/breejs/later">later</a>, and <a href="https://github.com/agenda/human-interval">human-friendly</a> support.
</div>
<hr />
<div align="center">
  Works in Node v12.17.0+, uses <a href="https://nodejs.org/api/worker_threads.html">worker threads</a> (Node.js) to spawn sandboxed processes, and supports <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function">async/await</a>, <a href="https://github.com/sindresorhus/p-retry">retries</a>, <a href="https://github.com/sindresorhus/p-throttle">throttling</a>, <a href="#concurrency">concurrency</a>, and <a href="#cancellation-retries-stalled-jobs-and-graceful-reloading">cancelable jobs with graceful shutdown</a>.  Simple, fast, and lightweight.  <strong>Made for <a href="https://forwardemail.net">Forward Email</a> and <a href="https://lad.js.org">Lad</a></strong>.
</div>


## Table of Contents

* [Foreword](#foreword)
* [Install](#install)
* [Upgrading](#upgrading)
* [Usage and Examples](#usage-and-examples)
  * [ECMAScript modules (ESM)](#ecmascript-modules-esm)
  * [CommonJS (CJS)](#commonjs-cjs)
* [Instance Options](#instance-options)
* [Job Options](#job-options)
* [Job Interval and Timeout Values](#job-interval-and-timeout-values)
* [Listening for events](#listening-for-events)
* [Custom error/message handling](#custom-errormessage-handling)
* [Cancellation, Retries, Stalled Jobs, and Graceful Reloading](#cancellation-retries-stalled-jobs-and-graceful-reloading)
* [Interval, Timeout, Date, and Cron Validation](#interval-timeout-date-and-cron-validation)
* [Writing jobs with Promises and async-await](#writing-jobs-with-promises-and-async-await)
* [Callbacks, Done, and Completion States](#callbacks-done-and-completion-states)
* [Long-running jobs](#long-running-jobs)
* [Complex timeouts and intervals](#complex-timeouts-and-intervals)
* [Custom Worker Options](#custom-worker-options)
* [Using functions for jobs](#using-functions-for-jobs)
* [Typescript and Usage with Bundlers](#typescript-and-usage-with-bundlers)
* [Concurrency](#concurrency)
* [Plugins](#plugins)
  * [Available Plugins](#available-plugins)
  * [Creating plugins for Bree](#creating-plugins-for-bree)
* [Real-world usage](#real-world-usage)
* [Contributors](#contributors)
* [License](#license)


## Foreword

Bree was created to give you fine-grained control with simplicity, and has built-in support for workers, sandboxed processes, graceful reloading, cron jobs, dates, human-friendly time representations, and much more.

We recommend you to query a persistent database in your jobs, to prevent specific operations from running more than once.

Bree does not force you to use an additional database layer of [Redis][] or [MongoDB][] to manage job state.

In doing so, you should manage boolean job states yourself using queries.  For instance, if you have to send a welcome email to users, only send a welcome email to users that do not have a Date value set yet for `welcome_email_sent_at`.


## Install

[npm][]:

```sh
npm install bree
```

[yarn][]:

```sh
yarn add bree
```


## Upgrading

To see details about upgrading from the last major version, please see [UPGRADING.md](https://github.com/breejs/bree/blob/master/UPGRADING.md).

> **IMPORTANT:** [Bree v9.0.0](https://github.com/breejs/bree/releases/tag/v9.0.0) has several breaking changes, please see [UPGRADING.md](https://github.com/breejs/bree/blob/master/UPGRADING.md) for more insight.

> **NOTE:** [Bree v6.5.0](https://github.com/breejs/bree/releases/tag/v6.5.0) is the last version to support Node v10 and browsers.


## Usage and Examples

The example below assumes that you have a directory `jobs` in the root of the directory from which you run this example.  For example, if the example below is at `/path/to/script.js`, then `/path/to/jobs/` must also exist as a directory.  If you wish to disable this feature, then pass `root: false` as an option.

Inside this `jobs` directory are individual scripts which are run using [Workers][] per optional timeouts, and additionally, an optional interval or cron expression.  The example below contains comments, which help to clarify how this works.

The option `jobs` passed to a new instance of `Bree` (as shown below) is an Array.  It contains values which can either be a String (name of a job in the `jobs` directory, which is run on boot) OR it can be an Object with `name`, `path`, `timeout`, and `interval` properties.  If you do not supply a `path`, then the path is created using the root directory (defaults to `jobs`) in combination with the `name`.  If you do not supply values for `timeout` and/nor `interval`, then these values are defaulted to `0` (which is the default for both, see [index.js](https://github.com/breejs/bree/blob/master/src/index.js) for more insight into configurable default options).

We have also documented all [Instance Options](#instance-options) and [Job Options](#job-options) in this README below.  Be sure to read those sections so you have a complete understanding of how Bree works.

### ECMAScript modules (ESM)

```js
// app.mjs

import Bree from 'bree';

const bree = new Bree({
  // ... (see below) ...
});

// top-level await supported in Node v14.8+
await bree.start();

// ... (see below) ...
```

**Please reference the [#CommonJS](#commonjs-cjs) example below for more insight and options.**

### CommonJS (CJS)

```js
// app.js

const path = require('path');

// optional
const ms = require('ms');
const dayjs = require('dayjs');
const Graceful = require('@ladjs/graceful');
const Cabin = require('cabin');

// required
const Bree = require('bree');

//
// NOTE: see the "Instance Options" section below in this README
// for the complete list of options and their defaults
//
const bree = new Bree({
  //
  // NOTE: by default the `logger` is set to `console`
  // however we recommend you to use CabinJS as it
  // will automatically add application and worker metadata
  // to your log output, and also masks sensitive data for you
  // <https://cabinjs.com>
  //
  // NOTE: You can also pass `false` as `logger: false` to disable logging
  //
  logger: new Cabin(),

  //
  // NOTE: instead of passing this Array as an option
  // you can create a `./jobs/index.js` file, exporting
  // this exact same array as `module.exports = [ ... ]`
  // doing so will allow you to keep your job configuration and the jobs
  // themselves all in the same folder and very organized
  //
  // See the "Job Options" section below in this README
  // for the complete list of job options and configurations
  //
  jobs: [
    // runs `./jobs/foo.js` on start
    'foo',

    // runs `./jobs/foo-bar.js` on start
    {
      name: 'foo-bar'
    },

    // runs `./jobs/some-other-path.js` on start
    {
      name: 'beep',
      path: path.join(__dirname, 'jobs', 'some-other-path')
    },

    // runs `./jobs/worker-1.js` on the last day of the month
    {
      name: 'worker-1',
      interval: 'on the last day of the month'
    },

    // runs `./jobs/worker-2.js` every other day
    {
      name: 'worker-2',
      interval: 'every 2 days'
    },

    // runs `./jobs/worker-3.js` at 10:15am and 5:15pm every day except on Tuesday
    {
      name: 'worker-3',
      interval: 'at 10:15 am also at 5:15pm except on Tuesday'
    },

    // runs `./jobs/worker-4.js` at 10:15am every weekday
    {
      name: 'worker-4',
      cron: '15 10 ? * *',
      cronValidate: {
        override: {
          useBlankDay: true
        }
      }
    },

    // runs `./jobs/worker-5.js` on after 10 minutes have elapsed
    {
      name: 'worker-5',
      timeout: '10m'
    },

    // runs `./jobs/worker-6.js` after 1 minute and every 5 minutes thereafter
    {
      name: 'worker-6',
      timeout: '1m',
      interval: '5m'
      // this is unnecessary but shows you can pass a Number (ms)
      // interval: ms('5m')
    },

    // runs `./jobs/worker-7.js` after 3 days and 4 hours
    {
      name: 'worker-7',
      // this example uses `human-interval` parsing
      timeout: '3 days and 4 hours'
    },

    // runs `./jobs/worker-8.js` at midnight (once)
    {
      name: 'worker-8',
      timeout: 'at 12:00 am'
    },

    // runs `./jobs/worker-9.js` every day at midnight
    {
      name: 'worker-9',
      interval: 'at 12:00 am'
    },

    // runs `./jobs/worker-10.js` at midnight on the 1st of every month
    {
      name: 'worker-10',
      cron: '0 0 1 * *'
    },

    // runs `./jobs/worker-11.js` at midnight on the last day of month
    {
      name: 'worker-11',
      cron: '0 0 L * *',
      cronValidate: {
        useLastDayOfMonth: true
      }
    },

    // runs `./jobs/worker-12.js` at a specific Date (e.g. in 3 days)
    {
      name: 'worker-12',
      // <https://github.com/iamkun/dayjs>
      date: dayjs().add(3, 'days').toDate()
      // you can also use momentjs
      // <https://momentjs.com/>
      // date: moment('1/1/20', 'M/D/YY').toDate()
      // you can pass Date instances (if it's in the past it will not get run)
      // date: new Date()
    },

    // runs `./jobs/worker-13.js` on start and every 2 minutes
    {
      name: 'worker-13',
      interval: '2m'
    },

    // runs `./jobs/worker-14.js` on start with custom `new Worker` options (see below)
    {
      name: 'worker-14',
      // <https://nodejs.org/api/worker_threads.html#worker_threads_new_worker_filename_options>
      worker: {
        workerData: {
          foo: 'bar',
          beep: 'boop'
        }
      }
    },

    // runs `./jobs/worker-15.js` **NOT** on start, but every 2 minutes
    {
      name: 'worker-15',
      timeout: false, // <-- specify `false` here to prevent default timeout (e.g. on start)
      interval: '2m'
    },

    // runs `./jobs/worker-16.js` on January 1st, 2022
    // and at midnight on the 1st of every month thereafter
    {
      name: 'worker-16',
      date: dayjs('1-1-2022', 'M-D-YYYY').toDate(),
      cron: '0 0 1 * *'
    }
  ]
});

// handle graceful reloads, pm2 support, and events like SIGHUP, SIGINT, etc.
const graceful = new Graceful({ brees: [bree] });
graceful.listen();

// start all jobs (this is the equivalent of reloading a crontab):
(async () => {
  await bree.start();
})();

/*
// start only a specific job:
(async () => {
  await bree.start('foo');
})();

// stop all jobs
bree.stop();

// stop only a specific job:
bree.stop('beep');

// run all jobs (this does not abide by timeout/interval/cron and spawns workers immediately)
bree.run();

// run a specific job (...)
bree.run('beep');

(async () => {
  // add a job array after initialization:
  const added = await bree.add(['boop']); // will return array of added jobs
  // this must then be started using one of the above methods

  // add a job after initialization:
  await bree.add('boop');
  // this must then be started using one of the above methods
})();


// remove a job after initialization:
bree.remove('boop');
*/
```

For more examples - including setting up bree with TypeScript, ESModules, and implementing an Email Queue, see the [examples](./examples) folder.

For a more complete demo using express see: [Bree Express Demo](https://github.com/breejs/express-example)


## Instance Options

Here is the full list of options and their defaults.  See [src/index.js](https://github.com/breejs/bree/blob/master/src/index.js) for more insight if necessary.

| Property                | Type     | Default Value          | Description                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------- | -------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logger`                | Object   | `console`              | This is the default logger.  **We recommend using [Cabin][cabin]** instead of using `console` as your default logger.  Set this value to `false` to disable logging entirely (uses noop function)                                                                                                                                                                                                                                                        |
| `root`                  | String   | `path.resolve('jobs')` | Resolves a jobs folder relative to where the project is ran (the directory you call `node` in). Set this value to `false` to prevent requiring a root directory of jobs (e.g. if your jobs are not all in one directory). Set this to `path.join(__dirname, 'jobs')` to keep your jobs directory relative to the file where Bree is set up.                                                                                                              |
| `silenceRootCheckError` | Boolean  | `false`                | Silences errors from requiring the root folder. Set this to `false` if you do not want to see errors from this operation                                                                                                                                                                                                                                                                                                                                 |
| `doRootCheck`           | Boolean  | `true`                 | Attempts to `require` the root directory, when `jobs` is empty or `null`. Set this to `false` to prevent requiring the root directory                                                                                                                                                                                                                                                                                                                    |
| `removeCompleted`       | Boolean  | `false`                | Removes job upon completion. Set this to `true` in order to remove jobs from the array upon completion.                                                                                                                                                                                                                                                                                                                                                  |
| `timeout`               | Number   | `0`                    | Default timeout for jobs (e.g. a value of `0` means that jobs will start on boot by default unless a job has a property of `timeout` or `interval` defined.  Set this to `false` if you do not wish for a default value to be set for jobs. **This value does not apply to jobs with a property of `date`.**                                                                                                                                             |
| `interval`              | Number   | `0`                    | Default interval for jobs (e.g. a value of `0` means that there is no interval, and a value greater than zero indicates a default interval will be set with this value).  **This value does not apply to jobs with a property of `cron`**.                                                                                                                                                                                                               |
| `jobs`                  | Array    | `[]`                   | Defaults to an empty Array, but if the `root` directory has a `index.js` file, then it will be used.  This allows you to keep your jobs and job definition index in the same place.  See [Job Options](#job-options) below, and [Usage and Examples](#usage-and-examples) above for more insight.                                                                                                                                                        |
| `hasSeconds`            | Boolean  | `false`                | This value is passed to `later` for parsing jobs, and can be overridden on a per job basis.  See [later cron parsing](https://breejs.github.io/later/parsers.html#cron) documentation for more insight. Note that setting this to `true` will automatically set `cronValidate` defaults to have `{ preset: 'default', override: { useSeconds: true } }`                                                                                                  |
| `cronValidate`          | Object   | `{}`                   | This value is passed to `cron-validate` for validation of cron expressions.  See the [cron-validate](https://github.com/Airfooox/cron-validate) documentation for more insight.                                                                                                                                                                                                                                                                          |
| `closeWorkerAfterMs`    | Number   | `0`                    | If you set a value greater than `0` here, then it will terminate workers after this specified time (in milliseconds).  **As of v6.0.0, workers now terminate after they have been signaled as "online" (as opposed to previous versions which did not take this into account and started the timer when jobs were initially "run").**  By default there is no termination done, and jobs can run for infinite periods of time.                           |
| `defaultRootIndex`      | String   | `index.js`             | This value should be the file name inside of the `root` directory option (if you pass a `root` directory or use the default `root` String value (and your index file name is different than `index.js`).                                                                                                                                                                                                                                                 |
| `defaultExtension`      | String   | `js`                   | This value can either be `js` or `mjs`.  The default is `js`, and is the default extension added to jobs that are simply defined with a name and without a path.  For example, if you define a job `test`, then it will look for `/path/to/root/test.js` as the file used for workers.                                                                                                                                                                   |
| `acceptedExtensions`    | Array    | `['.js', '.mjs']`      | This defines all of the accepted extensions for file validation and job creation. Please note if you add to this list you must override the `createWorker` function to properly handle the new file types.                                                                                                                                                                                                                                               |
| `worker`                | Object   | `{}`                   | These are default options to pass when creating a `new Worker` instance.  See the [Worker class](https://nodejs.org/api/worker_threads.html#worker_threads_new_worker_filename_options) documentation for more insight.                                                                                                                                                                                                                                  |
| `outputWorkerMetadata`  | Boolean  | `false`                | By default worker metadata is not passed to the second Object argument of `logger`.  However if you set this to `true`, then `logger` will be invoked internally with two arguments (e.g. `logger.info('...', { worker: ... })`).  This `worker` property contains `isMainThread` (Boolean), `resourceLimits` (Object), and `threadId` (String) properties; all of which correspond to [Workers][] metadata.  This can be overridden on a per job basis. |
| `errorHandler`          | Function | `null`                 | Set this function to receive a callback when an error is encountered during worker execution (e.g. throws an exception) or when it exits with non-zero code (e.g. `process.exit(1)`). The callback receives two parameters `error` and `workerMetadata`. Important note, when this callback is present default error logging will not be executed.                                                                                                       |
| `workerMessageHandler`  | Function | `null`                 | Set this function to receive a callback when a worker sends a message through [parentPort.postMessage](https://nodejs.org/docs/latest-v14.x/api/worker_threads.html#worker_threads_port_postmessage_value_transferlist). The callback receives at least two parameters `name` (of the worker) and `message` (coming from `postMessage`), if `outputWorkerMetadata` is enabled additional metadata will be sent to this handler.                          |


## Job Options

See [Interval, Timeout, Date, and Cron Validate](#interval-timeout-date-and-cron-validation) below for more insight besides this table:

| Property               | Type                               | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                 | String                             | The name of the job.  This should match the base file path (e.g. `foo` if `foo.js` is located at `/path/to/jobs/foo.js`) unless `path` option is specified.  A value of `index`, `index.js`, and `index.mjs` are reserved values and cannot be used here.                                                                                                                                                                                                                                                       |
| `path`                 | String                             | The path of the job or function used for spawning a new [Worker][workers] with.  If not specified, then it defaults to the value for `name` plus the default file extension specified under [Instance Options](#instance-options).                                                                                                                                                                                                                                                                              |
| `timeout`              | Number, Object, String, or Boolean | Sets the duration in milliseconds before the job starts (it overrides the default inherited `timeout` as set in [Instance Options](#instance-options).  A value of `0` indicates it will start immediately.  This value can be a Number, String, or a Boolean of `false` (which indicates it will NOT inherit the default `timeout` from [Instance Options](#instance-options)).  See [Job Interval and Timeout Values](#job-interval-and-timeout-values) below for more insight into how this value is parsed. |
| `interval`             | Number, Object, or String          | Sets the duration in milliseconds for the job to repeat itself, otherwise known as its interval (it overrides the default inherited `interval` as set in [Instance Options](#instance-options)).  A value of `0` indicates it will not repeat and there will be no interval.  If the value is greater than `0` then this value will be used as the interval.  See [Job Interval and Timeout Values](#job-interval-and-timeout-values) below for more insight into how this value is parsed.                     |
| `date`                 | Date                               | This must be a valid JavaScript Date (we use `instance of Date` for comparison).  If this value is in the past, then it is not run when jobs are started (or run manually).  We recommend using [dayjs][] for creating this date, and then formatting it using the `toDate()` method (e.g. `dayjs().add('3, 'days').toDate()`).  You could also use [moment][] or any other JavaScript date library, as long as you convert the value to a Date instance here.                                                  |
| `cron`                 | String                             | A cron expression to use as the job's interval, which is validated against [cron-validate][] and parsed by [later][].                                                                                                                                                                                                                                                                                                                                                                                           |
| `hasSeconds`           | Boolean                            | Overrides the [Instance Options](#instance-options) `hasSeconds` property if set.  Note that setting this to `true` will automatically set `cronValidate` defaults to have `{ preset: 'default', override: { useSeconds: true } }`                                                                                                                                                                                                                                                                              |
| `cronValidate`         | Object                             | Overrides the [Instance Options](#instance-options) `cronValidate` property if set.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `closeWorkerAfterMs`   | Number                             | Overrides the [Instance Options](#instance-options) `closeWorkerAfterMs` property if set.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `worker`               | Object                             | Overrides the [Instance Options](#instance-options) `worker` property if set.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `outputWorkerMetadata` | Boolean                            | Overrides the [Instance Options](#instance-options) `outputWorkerMetadata` property if set.                                                                                                                                                                                                                                                                                                                                                                                                                     |


## Job Interval and Timeout Values

These values can include Number, Object, and String variable types:

* Number values indicates the number of milliseconds for the timeout or interval
* Object values must be a [later][] schedule object value (e.g. `later.parse.cron('15 10 * * ? *'))`)
* String values can be either a [later][], [human-interval][], or [ms][] String values (e.g. [later][] supports Strings such as `every 5 mins`, [human-interval][] supports Strings such as `3 days and 4 hours`, and [ms][] supports Strings such as `4h` for four hours)


## Listening for events

Bree extends from [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter) and emits two events:

* `worker created` with an argument of `name`
* `worker deleted` with an argument of `name`

If you'd like to know when your workers are created (or deleted), you can do so through this example:

```js
bree.on('worker created', (name) => {
  console.log('worker created', name);
  console.log(bree.workers.get(name));
});

bree.on('worker deleted', (name) => {
  console.log('worker deleted', name);
  console.log(!bree.worker.has(name));
});
```


## Custom error/message handling

If you'd like to override default behavior for worker error/message handling, provide a callback function as `errorHandler` or `workerMessageHandler` parameter when creating a Bree instance.

> **NOTE:** Any `console.log` calls, from within the worker,  will not be sent to `stdout`/`stderr` until the main thread is available. Furthermore, any `console.log` calls, from within the worker, will not be sent if the process is terminated before the message is printed. You should use `parentPort.postMessage()` alongside `errorHandler` or `workerMessageHandler` to print to `stdout`/`stderr` during worker execution. This is a known [bug](https://github.com/nodejs/node/issues/30491) for workers.

An example use-case. If you want to call an external service to record an error (like Honeybadger, Sentry, etc.) along with logging the error internally. You can do so with:

```js
const logger = ('../path/to/logger');
const errorService = ('../path/to/error-service');

new Bree({
  jobs: [
    {
      name: 'job that sometimes throws errors',
      path: jobFunction
    }
  ],
  errorHandler: (error, workerMetadata) => {
    // workerMetadata will be populated with extended worker information only if
    // Bree instance is initialized with parameter `workerMetadata: true`
    if (workerMetadata.threadId) {
      logger.info(`There was an error while running a worker ${workerMetadata.name} with thread ID: ${workerMetadata.threadId}`)
    } else {
      logger.info(`There was an error while running a worker ${workerMetadata.name}`)
    }

    logger.error(error);
    errorService.captureException(error);
  }
});
```


## Cancellation, Retries, Stalled Jobs, and Graceful Reloading

We recommend that you listen for "cancel" event in your worker paths.  Doing so will allow you to handle graceful cancellation of jobs.  For example, you could use [p-cancelable][]

Here's a quick example of how to do that (e.g. `./jobs/some-worker.js`):

```js
// <https://nodejs.org/api/worker_threads.html>
const { parentPort } = require('worker_threads');

// ...

function cancel() {
  // do cleanup here
  // (if you're using @ladjs/graceful, the max time this can run by default is 5s)

  // send a message to the parent that we're ready to terminate
  // (you could do `process.exit(0)` or `process.exit(1)` instead if desired
  // but this is a bit of a cleaner approach for worker termination
  if (parentPort) parentPort.postMessage('cancelled');
  else process.exit(0);
}

if (parentPort)
  parentPort.once('message', message => {
    if (message === 'cancel') return cancel();
  });
```

If you'd like jobs to retry, simply wrap your usage of promises with [p-retry][].

We leave it up to you to have as much fine-grained control as you wish.

See [@ladjs/graceful][lad-graceful] for more insight into how this package works.


## Interval, Timeout, Date, and Cron Validation

If you need help writing cron expressions, you can reference [crontab.guru](https://crontab.guru/).

We support [later][], [human-interval][], or [ms][] String values for both `timeout` and `interval`.

If you pass a `cron` property, then it is validated against [cron-validate][].

You can pass a Date as the `date` property, but you cannot combine both `date` and `timeout`.

If you do pass a Date, then it is only run if it is in the future.

See [Job Interval and Timeout Values](#job-interval-and-timeout-values) above for more insight.


## Writing jobs with Promises and async-await

If jobs are running with Node pre-[v14.8.0](https://nodejs.org/en/blog/release/v14.8.0/), which [enables top-level async-await](https://github.com/nodejs/node/commit/62bb2e757f) support, here is the working alternative:

```js
const { parentPort } = require('worker_threads');

const delay = require('delay');
const ms = require('ms');

(async () => {
  // wait for a promise to finish
  await delay(ms('10s'));

  // signal to parent that the job is done
  if (parentPort) parentPort.postMessage('done');
  else process.exit(0);
})();
```


## Callbacks, Done, and Completion States

To close out the worker and signal that it is done, you can simply `parentPort.postMessage('done');` and/or `process.exit(0)`.

While writing your jobs (which will run in [worker][workers] threads), you should do one of the following:

* Signal to the main thread that the process has completed by sending a "done" message (per the example above in [Writing jobs with Promises and async-await](#writing-jobs-with-promises-and-async-await))
* Exit the process if there is NOT an error with code `0` (e.g. `process.exit(0);`)
* Throw an error if an error occurs (this will bubble up to the worker event error listener and terminate it)
* Exit the process if there IS an error with code `1` (e.g. `process.exit(1)`)


## Long-running jobs

If a job is already running, a new worker thread will not be spawned, instead `logger.error` will be invoked with an error message (no error will be thrown, don't worry).  This is to prevent bad practices from being used.  If you need something to be run more than one time, then make the job itself run the task multiple times.  This approach gives you more fine-grained control.

By default, workers run indefinitely and are not closed until they exit (e.g. via `process.exit(0)` or `process.exit(1)`, OR send to the parent port a "close" message, which will subsequently call `worker.close()` to close the worker thread.

If you wish to specify a maximum time (in milliseconds) that a worker can run, then pass `closeWorkerAfterMs` (Number) either as a default option when creating a `new Bree()` instance (e.g. `new Bree({ closeWorkerAfterMs: ms('10s') })`) or on a per-job configuration, e.g. `{ name: 'beep', closeWorkerAfterMs: ms('5m') }`.

As of v6.0.0 when you pass `closeWorkerAfterMs`, the timer will start once the worker is signaled as "online" (as opposed to previous versions which did not take this into account).


## Complex timeouts and intervals

Since we use [later][], you can pass an instance of `later.parse.recur`, `later.parse.cron`, or `later.parse.text` as the `timeout` or `interval` property values (e.g. if you need to construct something manually).

You can also use [dayjs][] to construct dates (e.g. from now or a certain date) to millisecond differences using `dayjs().diff(new Date(), 'milliseconds')`.  You would then pass that returned Number value as `timeout` or `interval` as needed.


## Custom Worker Options

You can pass a default worker configuration object as `new Bree({ worker: { ... } });`.

These options are passed to the `options` argument when we internally invoke `new Worker(path, options)`.

Additionally, you can pass custom worker options on a per-job basis through a `worker` property Object on the job definition.

See [complete documentation](https://nodejs.org/api/worker_threads.html#worker_threads_new_worker_filename_options) for options (but you usually don't have to modify these).


## Using functions for jobs

It is highly recommended to use files instead of functions. However, sometimes it is necessary to use functions.

You can pass a function to be run as a job:

```js
new Bree({ jobs: [someFunction] });
```

(or)

```js
new Bree({
  jobs: [
    {
      name: 'job with function',
      path: someFunction
    }
  ]
});
```

The function will be run as if it's in its own file, therefore no variables or dependencies will be shared from the local context by default.

You should be able to pass data via `worker.workerData` (see [Custom Worker Options](#custom-worker-options)).

Note that you cannot pass a built-in nor bound function.


## Typescript and Usage with Bundlers

When working with a bundler or a tool that transpiles your code in some form or another, we recommend that your bundler is set up in a way that transforms both your application code and your jobs. Because your jobs are in their own files and are run in their own separate threads, they will not be part of your applications dependency graph and need to be setup as their own entry points. You need to ensure you have configured your tool to bundle your jobs into a jobs folder and keep them properly relative to your entry point folder.

We recommend setting the `root` instance options to `path.join(__dirname,'jobs')` so that bree searches for your jobs folder relative to the file being ran. (by default it searches for jobs relative to where `node` is invoked). We recommend treating each job as an entry point and running all jobs through the same transformations as your app code.

After an example transformation - you should expect the output in your `dist` folder to look like:

```tree
- dist
  |-jobs
    |-job.js
  |-index.js
```

For some example TypeScript set ups - see the [examples folder](https://github.com/breejs/bree/tree/master/examples).

For another alternative also see the [@breejs/ts-worker](https://github.com/breejs/ts-worker) plugin.


## Concurrency

We recommend using the following packages in your workers for handling concurrency:

* <https://github.com/sindresorhus/p-all>
* <https://github.com/sindresorhus/p-limit>
* <https://github.com/sindresorhus/p-queue>
* <https://github.com/sindresorhus/p-map>


## Plugins

Plugins can be added to Bree using a similar method to [Day.js](https://day.js.org/)

To add a plugin use the following method:

```js
Bree.extend(plugin, options);
```

### Available Plugins

* [API](https://github.com/breejs/api)
* [TypeScript Worker](https://github.com/breejs/ts-worker)

### Creating plugins for Bree

Plugins should be a function that recieves an `options` object and the `Bree` class:

```js
  const plugin = (options, Bree) => {
    /* plugin logic */
  };
```


## Real-world usage

More detailed examples can be found in [Forward Email][forward-email], [Lad][], and [Ghost][ghost].


## Contributors

| Name             | Website                           |
| ---------------- | --------------------------------- |
| **Nick Baugh**   | <http://niftylettuce.com/>        |
| **shadowgate15** | <https://github.com/shadowgate15> |


## License

[MIT](LICENSE) © [Nick Baugh](http://niftylettuce.com/)


##

<a href="#"><img src="https://d1i8ikybhfrv4r.cloudfront.net/bree/footer.png" alt="#" /></a>

[ms]: https://github.com/vercel/ms

[human-interval]: https://github.com/agenda/human-interval

[npm]: https://www.npmjs.com/

[yarn]: https://yarnpkg.com/

[workers]: https://nodejs.org/api/worker_threads.html

[lad]: https://lad.js.org

[p-retry]: https://github.com/sindresorhus/p-retry

[p-cancelable]: https://github.com/sindresorhus/p-cancelable

[later]: https://breejs.github.io/later/parsers.html

[cron-validate]: https://github.com/Airfooox/cron-validate

[forward-email]: https://github.com/forwardemail/forwardemail.net

[dayjs]: https://github.com/iamkun/dayjs

[redis]: https://redis.io/

[mongodb]: https://www.mongodb.com/

[lad-graceful]: https://github.com/ladjs/graceful

[cabin]: https://cabinjs.com

[moment]: https://momentjs.com

[ghost]: https://ghost.org/
