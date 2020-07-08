# [**bree**](https://github.com/breejs/bree)

[![build status](https://img.shields.io/travis/com/breejs/bree.svg)](https://travis-ci.com/breejs/bree)
[![code coverage](https://img.shields.io/codecov/c/github/breejs/bree.svg)](https://codecov.io/gh/breejs/bree)
[![code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![made with lass](https://img.shields.io/badge/made_with-lass-95CC28.svg)](https://lass.js.org)
[![license](https://img.shields.io/github/license/breejs/bree.svg)](LICENSE)
[![npm downloads](https://img.shields.io/npm/dt/breejs/bree.svg)](https://npm.im/bree)

> The best job scheduler for [Node.js][node] with support for [cron][], [ms][], and [human-friendly][human-interval] strings.  Uses [workers][] and spawns sandboxed processes.  Supports [async/await][async-await], [retries][p-retry], [throttling][p-throttle], [concurrency](#concurrency), and [cancelable][p-cancelable] jobs (graceful shutdown).  Simple, fast, and the most lightweight tool for the job.  Made for [Forward Email][forward-email] and [Lad][].


## Table of Contents

* [Foreword](#foreword)
* [Install](#install)
* [Usage and Examples](#usage-and-examples)
* [Cancellation, Retries, Stalled Jobs, and Graceful Reloading](#cancellation-retries-stalled-jobs-and-graceful-reloading)
* [Interval, Timeout, and Cron Validation](#interval-timeout-and-cron-validation)
* [Long-running jobs](#long-running-jobs)
* [Complex timeouts and intervals](#complex-timeouts-and-intervals)
* [Concurrency](#concurrency)
* [Real-world usage](#real-world-usage)
* [Alternatives that are not production-ready](#alternatives-that-are-not-production-ready)
* [Contributors](#contributors)
* [License](#license)


## Foreword

Before creating Bree, I was a core maintainer (and financially invested in development) of [Agenda][].  I have been with the Node.js community for a very, very long time, and have tried literally every solution out there (see [Alternatives that are not production-ready](#alternatives-that-are-not-production-ready)).  I have found that all existing solutions are subpar, as I have filed countless issues; discovered memory leaks, found functionality not working as described, unresolved core bugs have persisted over time, etc.

Previous to creating this, I was relying heavily on [bull][]; having created [@ladjs/bull][] – but due to core issues (and being Redis-backed) it was not the best tool for the job.  [Bull][] might have been okay if the core issues were fixed, however since it uses [Redis][] it should not be used for a job queue.  From my experience, [Redis][] should only be used for caching and session storage purposes (e.g. CDN or managing user log in state in your application).

Since [workers][] are now readily available in LTS versions of Node, I thought it would be a great time to implement them in a job scheduler environment.  Additionally, my research and development of a better anti-spam and anti-phishing classifier with [Spam Scanner][spam-scanner] gave me some necessary insight to using [workers][].

Bree was created to give you fine-grained control with simplicity, and has built-in support for workers, sandboxed processes, graceful reloading, cron jobs, dates, human-friendly time representations, and much more.  We recommend you to query a persistent database in your jobs, to prevent specific operations from running more than once.  Bree does not force you to use an additional database layer of [Redis][] or [MongoDB][] to manage job state.  In doing so, you should manage boolean job states yourself using queries.  For instance, if you have to send a welcome email to users, only send a welcome email to users that do not have a Date value set yet for `welcome_email_sent_at`.


## Install

[npm][]:

```sh
npm install bree
```

[yarn][]:

```sh
yarn add bree
```


## Usage and Examples

The example below assumes that you have a directory `jobs` in the root of the directory from which you run this example.  For example, if the example below is at `/path/to/script.js`, then `/path/to/jobs/` must also exist as a directory.  If you wish to disable this feature, then pass `root: false` as an option.

Inside this `jobs` directory are individual scripts which are run using [Workers][] per optional timeouts, and additionally, an optional interval or cron expression.  Examples to help clarify this are provided in the code snippet below.

The option `jobs` passed to a new instance of `Cron` (as shown below) is an Array.  It contains values which can either be a String (name of a job in the `jobs` directory, which is run on boot) OR it can be an Object with `name`, `path`, `timeout`, and `interval` properties.  If you do not supply a `path`, then the path is created using the root directory (defaults to `jobs`) in combination with the `name`.  If you do not supply values for `timeout` and/nor `interval`, then these values are defaulted to `0` (which is the default for both, see [index.js](index.js) for more insight into configurable default options).

```js
const path = require('path');

const ms = require('ms'); // optional
const dayjs = require('dayjs'); // optional
const Graceful = require('@ladjs/graceful'); // optional

const Bree = require('bree');

//
// NOTE: see index.js for full list of options and defaults
//
const bree = new Bree({
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
    }

    // runs `./jobs/worker-4.js` at 10:15am every weekday
    {
      name: 'worker-4',
      cron: '15 10 ? * *'
    },

    // runs `./jobs/worker-5.js` on start after 10 minutes have elapsed
    {
      name: 'worker-5',
      timeout: '10m'
    },

    // runs `./jobs/worker-6.js` every 5 minutes after 1 minute has elapsed
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
      cron: '0 0 L * *'
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
    }
  ]
});

// handle graceful reloads, pm2 support, and events like SIGHUP, SIGINT, etc.
const graceful = new Graceful({ brees: [bree] });
graceful.listen();

// start all jobs (this is the equivalent of reloading a crontab):
bree.start();

/*
// start only a specific job:
bree.start('foo');

// stop all jobs
bree.stop();

// stop only a specific job:
bree.stop('beep');

// run all jobs (this does not abide by timeout/interval/cron and spawns workers immediately)
bree.run();

// run a specific job (...)
bree.run('beep');
*/
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
  parentPort.postMessage('cancelled');
}

parentPort.once('message', message => {
  if (message === 'cancel') return cancel();
});
```

If you'd like jobs to retry, simply wrap your usage of promises with [p-retry][].

We leave it up to you to have as much fine-grained control as you wish.


## Interval, Timeout, and Cron Validation

If you need help writing cron expressions, you can reference [crontab.guru](https://crontab.guru/).

We support [ms][], [human-interval][], and [later][] String values for both `timeout` and `interval`.

If you pass a `cron` property, then it is validated against [cron-validate][].

You can pass a Date as the `date` property, but you cannot combine both `date` and `timeout`.

If you do pass a Date, then it is only run if it is in the future.


## Long-running jobs

If a job is already running, a new worker thread will not be spawned, instead an error will be thrown.  This is to prevent bad practices from being used.  If you need something to be run more than one time, then make the job itself run the task multiple times.  This approach gives you more fine-grained control.

By default, workers run indefinitely and are not closed until they exit (e.g. via `process.exit(0)` or `process.exit(1)`, OR send to the parent port a "close" message, which will subsequently call `worker.close()` to close the worker thread.

If you wish to specify a maximum time (in milliseconds) that a worker can run, then pass `closeWorkerAfterMs` (Number) either as a default option when creating a `new Bree()` instance (e.g. `new Bree({ closeWorkerAfterMs: ms('10s') })`) or on a per-job configuration, e.g. `{ name: 'beep', closeWorkerAfterMs: ms('5m') }`.


## Complex timeouts and intervals

Since we use [later][], you can pass an instance of `later.schedule` as the `timeout` or `interval` property values (e.g. if you need to construct something manually).

You can also use [dayjs][] to construct dates (e.g. from now or a certain date) to millisecond differences using `dayjs().diff(new Date(), 'milliseconds')`.  You would then pass that returned Number value as `timeout` or `interval` as needed.


## Concurrency

We recommend using the following packages in your workers for handling concurrency:

* <https://github.com/sindresorhus/p-all>
* <https://github.com/sindresorhus/p-limit>
* <https://github.com/sindresorhus/p-queue>
* <https://github.com/sindresorhus/p-map>


## Real-world usage

More detailed examples can be found in [Forward Email][forward-email] and [Lad][].


## Alternatives that are not production-ready

* [bull][] has core issues with [repeatable jobs](https://github.com/OptimalBits/bull/issues/1739), [emptying of jobs](https://github.com/OptimalBits/bull/issues/1792), and [event emitters](https://github.com/OptimalBits/bull/issues/1659)
* [@ladjs/bull][] used [bull][] internally, but was unusable due to [bull issues](https://github.com/ladjs/bull/issues/2)
* [agenda][] had memory leaks, [12 issues filed by myself alone](https://github.com/agenda/agenda/issues?q=author%3Aniftylettuce), has 100+ open issues, and is poorly architected
* [kue][] is no longer maintained, has core bugs, and recommends [bull][] (and its Redis backed too)
* [node-cron][] does not provide enough functionality out of the box, as it only provides function invocation using cron expression intervals
* [sfn-scheduler][] did [not support](https://github.com/hyurl/sfn-scheduler/issues/1) cronjob syntax and did not have any means to spawn worker threads nor jobs in general


## Contributors

| Name           | Website                    |
| -------------- | -------------------------- |
| **Nick Baugh** | <http://niftylettuce.com/> |


## License

[MIT](LICENSE) © [Nick Baugh](http://niftylettuce.com/)


##

[ms]: https://github.com/vercel/ms

[human-interval]: https://github.com/agenda/human-interval

[npm]: https://www.npmjs.com/

[yarn]: https://yarnpkg.com/

[workers]: https://nodejs.org/api/worker_threads.html

[lad]: https://lad.js.org

[p-retry]: https://github.com/sindresorhus/p-retry

[p-cancelable]: https://github.com/sindresorhus/p-cancelable

[later]: https://bunkat.github.io/later/parsers.html

[cron-validate]: https://github.com/Airfooox/cron-validate

[forward-email]: https://github.com/forwardemail/forwardemail.net

[dayjs]: https://github.com/iamkun/dayjs

[sfn-scheduler]: https://github.com/hyurl/sfn-scheduler

[spam-scanner]: https://spamscanner.net

[agenda]: https://github.com/agenda/agenda

[node-cron]: https://github.com/node-cron/node-cron

[kue]: https://github.com/Automattic/kue

[@ladjs/bull]: https://github.com/ladjs/bull

[bull]: https://github.com/OptimalBits/bull

[redis]: https://redis.io/

[p-throttle]: https://github.com/sindresorhus/p-throttle

[cron]: https://en.wikipedia.org/wiki/Cron

[node]: https://nodejs.org

[async-await]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function

[mongodb]: https://www.mongodb.com/
