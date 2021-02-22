const EventEmitter = require('events');
const fs = require('fs');
const { resolve } = require('path');
const pWaitFor = require('p-wait-for');
const combineErrors = require('combine-errors');
const debug = require('debug')('bree');
const isSANB = require('is-string-and-not-blank');
const isValidPath = require('is-valid-path');
const later = require('@breejs/later');
const threads = require('bthreads');
const { setTimeout, setInterval } = require('safe-timers');

const {
  isSchedule,
  getName,
  getHumanToMs,
  parseValue,
  getJobNames
} = require('./job-utils');
const buildJob = require('./job-builder');
const validateJob = require('./job-validator');

// Bthreads requires us to do this for web workers (see bthreads docs for insight)
threads.Buffer = Buffer;

// Instead of `threads.browser` checks below, we previously used this boolean
// const hasFsStatSync = typeof fs === 'object' && typeof fs.statSync === 'function';

class Bree extends EventEmitter {
  constructor(config) {
    super();
    this.config = {
      // We recommend using Cabin for logging
      // <https://cabinjs.com>
      logger: console,
      // Set this to `false` to prevent requiring a root directory of jobs
      // (e.g. if your jobs are not all in one directory)
      root: threads.browser /* istanbul ignore next */
        ? threads.resolve('jobs')
        : resolve('jobs'),
      // Default timeout for jobs
      // (set this to `false` if you do not wish for a default timeout to be set)
      timeout: 0,
      // Default interval for jobs
      // (set this to `0` for no interval, and > 0 for a default interval to be set)
      interval: 0,
      // This is an Array of your job definitions (see README for examples)
      jobs: [],
      // <https://breejs.github.io/later/parsers.html#cron>
      // (can be overridden on a job basis with same prop name)
      hasSeconds: false,
      // <https://github.com/Airfooox/cron-validate>
      cronValidate: {},
      // If you set a value > 0 here, then it will terminate workers after this time (ms)
      closeWorkerAfterMs: 0,
      // Could also be mjs if desired
      // (this is the default extension if you just specify a job's name without ".js" or ".mjs")
      defaultExtension: 'js',
      // Default worker options to pass to ~`new Worker`~ `new threads.Worker`
      // (can be overridden on a per job basis)
      // <https://nodejs.org/api/worker_threads.html#worker_threads_new_worker_filename_options>
      worker: {},
      // Custom handler to execute when error events are emitted by the workers or when they exit
      // with non-zero code
      // pass in a callback function with following signature: `(error, workerMetadata) => { // custom handling here }`
      errorHandler: null,
      // Custom handler executed when a `message` event is received from a worker.
      // A special 'done' even is also broadcasted while leaving worker shutdown logic in place.
      workerMessageHandler: null,
      //
      // if you set this to `true`, then a second arg is passed to log output
      // and it will be an Object with `{ worker: Object }` set, for example:
      // (see the documentation at <https://nodejs.org/api/worker_threads.html> for more insight)
      //
      // logger.info('...', {
      //   worker: {
      //     isMainThread: Boolean
      //     resourceLimits: Object,
      //     threadId: String
      //   }
      // });
      //
      outputWorkerMetadata: false,
      ...config
    };

    //
    // if `hasSeconds` is `true` then ensure that
    // `cronValidate` object has `override` object with `useSeconds` set to `true`
    // <https://github.com/breejs/bree/issues/7>
    //
    if (this.config.hasSeconds) {
      this.config.cronValidate = {
        ...this.config.cronValidate,
        preset:
          this.config.cronValidate && this.config.cronValidate.preset
            ? this.config.cronValidate.preset
            : 'default',
        override: {
          ...(this.config.cronValidate && this.config.cronValidate.override
            ? this.config.cronValidate.override
            : {}),
          useSeconds: true
        }
      };
    }

    debug('config', this.config);

    this.closeWorkerAfterMs = {};
    this.workers = {};
    this.timeouts = {};
    this.intervals = {};

    this.isSchedule = isSchedule;
    this.getWorkerMetadata = this.getWorkerMetadata.bind(this);
    this.run = this.run.bind(this);
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.add = this.add.bind(this);
    this.remove = this.remove.bind(this);

    this.validateJob = validateJob;
    this.getName = getName;
    this.getHumanToMs = getHumanToMs;
    this.parseValue = parseValue;

    // Validate root (sync check)
    if (isSANB(this.config.root)) {
      /* istanbul ignore next */
      if (!threads.browser && isValidPath(this.config.root)) {
        const stats = fs.statSync(this.config.root);
        if (!stats.isDirectory()) {
          throw new Error(
            `Root directory of ${this.config.root} does not exist`
          );
        }
      }
    }

    // Validate timeout
    this.config.timeout = this.parseValue(this.config.timeout);
    debug('timeout', this.config.timeout);

    // Validate interval
    this.config.interval = this.parseValue(this.config.interval);
    debug('interval', this.config.interval);

    //
    // if `this.config.jobs` is an empty array
    // then we should try to load `jobs/index.js`
    //
    if (
      this.config.root &&
      (!Array.isArray(this.config.jobs) || this.config.jobs.length === 0)
    ) {
      try {
        this.config.jobs = threads.require(this.config.root);
      } catch (err) {
        this.config.logger.error(err);
      }
    }

    //
    // validate jobs
    //
    if (!Array.isArray(this.config.jobs)) {
      throw new TypeError('Jobs must be an Array');
    }

    // Provide human-friendly errors for complex configurations
    const errors = [];

    /*
    Jobs = [
      'name',
      { name: 'boot' },
      { name: 'timeout', timeout: ms('3s') },
      { name: 'cron', cron: '* * * * *' },
      { name: 'cron with timeout', timeout: '3s', cron: '* * * * *' },
      { name: 'interval', interval: ms('4s') }
      { name: 'interval', path: '/some/path/to/script.js', interval: ms('4s') },
      { name: 'timeout', timeout: 'three minutes' },
      { name: 'interval', interval: 'one minute' },
      { name: 'timeout', timeout: '3s' },
      { name: 'interval', interval: '30d' },
      { name: 'schedule object', interval: { schedules: [] } }
    ]
    */

    for (let i = 0; i < this.config.jobs.length; i++) {
      try {
        const names = getJobNames(this.config.jobs, i);

        validateJob(this.config.jobs[i], i, names, this.config);

        this.config.jobs[i] = buildJob(this.config.jobs[i], this.config);
      } catch (err) {
        errors.push(err);
      }
    }

    // If there were any errors then throw them
    if (errors.length > 0) {
      throw combineErrors(errors);
    }

    debug('this.config.jobs', this.config.jobs);
  }

  getWorkerMetadata(name, meta = {}) {
    const job = this.config.jobs.find((j) => j.name === name);
    if (!job) {
      throw new Error(`Job "${name}" does not exist`);
    }

    if (!this.config.outputWorkerMetadata && !job.outputWorkerMetadata) {
      return meta &&
        (typeof meta.err !== 'undefined' || typeof meta.message !== 'undefined')
        ? meta
        : undefined;
    }

    return this.workers[name]
      ? {
          ...meta,
          worker: {
            isMainThread: this.workers[name].isMainThread,
            resourceLimits: this.workers[name].resourceLimits,
            threadId: this.workers[name].threadId
          }
        }
      : meta;
  }

  run(name) {
    debug('run', name);
    if (name) {
      const job = this.config.jobs.find((j) => j.name === name);
      if (!job) {
        throw new Error(`Job "${name}" does not exist`);
      }

      if (this.workers[name]) {
        return this.config.logger.warn(
          new Error(`Job "${name}" is already running`),
          this.getWorkerMetadata(name)
        );
      }

      debug('starting worker', name);
      const object = {
        ...(this.config.worker ? this.config.worker : {}),
        ...(job.worker ? job.worker : {}),
        workerData: {
          job,
          ...(this.config.worker && this.config.worker.workerData
            ? this.config.worker.workerData
            : {}),
          ...(job.worker && job.worker.workerData ? job.worker.workerData : {})
        }
      };
      this.workers[name] = new threads.Worker(job.path, object);
      this.emit('worker created', name);
      debug('worker started', name);

      const prefix = `Worker for job "${name}"`;
      this.workers[name].on('online', () => {
        // If we specified a value for `closeWorkerAfterMs`
        // then we need to terminate it after that execution time
        const closeWorkerAfterMs = Number.isFinite(job.closeWorkerAfterMs)
          ? job.closeWorkerAfterMs
          : this.config.closeWorkerAfterMs;
        if (Number.isFinite(closeWorkerAfterMs) && closeWorkerAfterMs > 0) {
          debug('worker has close set', name, closeWorkerAfterMs);
          this.closeWorkerAfterMs[name] = setTimeout(() => {
            /* istanbul ignore else */
            if (this.workers[name]) {
              debug('worker has been terminated', name);
              this.workers[name].terminate();
            }
          }, closeWorkerAfterMs);
        }

        this.config.logger.info(
          `${prefix} online`,
          this.getWorkerMetadata(name)
        );
      });
      this.workers[name].on('message', (message) => {
        const metadata = this.getWorkerMetadata(name, { message });

        if (this.config.workerMessageHandler) {
          this.config.workerMessageHandler({
            name,
            ...metadata
          });
        } else if (message === 'done') {
          this.config.logger.info(`${prefix} signaled completion`, metadata);
        } else {
          this.config.logger.info(`${prefix} sent a message`, metadata);
        }

        if (message === 'done') {
          this.workers[name].removeAllListeners('message');
          this.workers[name].removeAllListeners('exit');
          this.workers[name].terminate();
          delete this.workers[name];
        }
      });
      // NOTE: you cannot catch messageerror since it is a Node internal
      //       (if anyone has any idea how to catch this in tests let us know)
      /* istanbul ignore next */
      this.workers[name].on('messageerror', (err) => {
        if (this.config.errorHandler) {
          this.config.errorHandler(err, {
            name,
            ...this.getWorkerMetadata(name, { err })
          });
        } else {
          this.config.logger.error(
            `${prefix} had a message error`,
            this.getWorkerMetadata(name, { err })
          );
        }
      });
      this.workers[name].on('error', (err) => {
        if (this.config.errorHandler) {
          this.config.errorHandler(err, {
            name,
            ...this.getWorkerMetadata(name, { err })
          });
        } else {
          this.config.logger.error(
            `${prefix} had an error`,
            this.getWorkerMetadata(name, { err })
          );
        }
      });
      this.workers[name].on('exit', (code) => {
        const level = code === 0 ? 'info' : 'error';
        if (level === 'error' && this.config.errorHandler) {
          this.config.errorHandler(
            new Error(`${prefix} exited with code ${code}`),
            {
              name,
              ...this.getWorkerMetadata(name)
            }
          );
        } else {
          this.config.logger[level](
            `${prefix} exited with code ${code}`,
            this.getWorkerMetadata(name)
          );
        }

        delete this.workers[name];
        this.emit('worker deleted', name);
      });
      return;
    }

    for (const job of this.config.jobs) {
      this.run(job.name);
    }
  }

  start(name) {
    debug('start', name);
    if (name) {
      const job = this.config.jobs.find((j) => j.name === name);
      if (!job) {
        throw new Error(`Job ${name} does not exist`);
      }

      if (this.timeouts[name] || this.intervals[name] || this.workers[name]) {
        return this.config.logger.warn(
          new Error(`Job "${name}" is already started`)
        );
      }

      debug('job', job);

      // Check for date and if it is in the past then don't run it
      if (job.date instanceof Date) {
        debug('job date', job);
        if (job.date.getTime() < Date.now()) {
          debug('job date was in the past');
          return;
        }

        this.timeouts[name] = setTimeout(() => {
          this.run(name);
          if (this.isSchedule(job.interval)) {
            debug('job.interval is schedule', job);
            this.intervals[name] = later.setInterval(
              () => this.run(name),
              job.interval
            );
          } else if (Number.isFinite(job.interval) && job.interval > 0) {
            debug('job.interval is finite', job);
            this.intervals[name] = setInterval(
              () => this.run(name),
              job.interval
            );
          } else {
            debug('job.date was scheduled to run only once', job);
          }

          delete this.timeouts[name];
        }, job.date.getTime() - Date.now());
        return;
      }

      // This is only complex because both timeout and interval can be a schedule
      if (this.isSchedule(job.timeout)) {
        debug('job timeout is schedule', job);
        this.timeouts[name] = later.setTimeout(() => {
          this.run(name);
          if (this.isSchedule(job.interval)) {
            debug('job.interval is schedule', job);
            this.intervals[name] = later.setInterval(
              () => this.run(name),
              job.interval
            );
          } else if (Number.isFinite(job.interval) && job.interval > 0) {
            debug('job.interval is finite', job);
            this.intervals[name] = setInterval(
              () => this.run(name),
              job.interval
            );
          }

          delete this.timeouts[name];
        }, job.timeout);
        return;
      }

      if (Number.isFinite(job.timeout)) {
        debug('job timeout is finite', job);
        this.timeouts[name] = setTimeout(() => {
          this.run(name);

          if (this.isSchedule(job.interval)) {
            debug('job.interval is schedule', job);
            this.intervals[name] = later.setInterval(
              () => this.run(name),
              job.interval
            );
          } else if (Number.isFinite(job.interval) && job.interval > 0) {
            debug('job.interval is finite', job.interval);
            this.intervals[name] = setInterval(
              () => this.run(name),
              job.interval
            );
          }

          delete this.timeouts[name];
        }, job.timeout);
      } else if (this.isSchedule(job.interval)) {
        debug('job.interval is schedule', job);
        this.intervals[name] = later.setInterval(
          () => this.run(name),
          job.interval
        );
      } else if (Number.isFinite(job.interval) && job.interval > 0) {
        debug('job.interval is finite', job);
        this.intervals[name] = setInterval(() => this.run(name), job.interval);
      }

      return;
    }

    for (const job of this.config.jobs) {
      this.start(job.name);
    }
  }

  async stop(name) {
    if (name) {
      if (this.timeouts[name]) {
        if (
          typeof this.timeouts[name] === 'object' &&
          typeof this.timeouts[name].clear === 'function'
        ) {
          this.timeouts[name].clear();
        }

        delete this.timeouts[name];
      }

      if (this.intervals[name]) {
        if (
          typeof this.intervals[name] === 'object' &&
          typeof this.intervals[name].clear === 'function'
        ) {
          this.intervals[name].clear();
        }

        delete this.intervals[name];
      }

      if (this.workers[name]) {
        this.workers[name].once('message', (message) => {
          if (message === 'cancelled') {
            this.config.logger.info(
              `Gracefully cancelled worker for job "${name}"`,
              this.getWorkerMetadata(name)
            );
            this.workers[name].terminate();
          }
        });
        this.workers[name].postMessage('cancel');
      }

      if (this.closeWorkerAfterMs[name]) {
        if (
          typeof this.closeWorkerAfterMs[name] === 'object' &&
          typeof this.closeWorkerAfterMs[name].clear === 'function'
        ) {
          this.closeWorkerAfterMs[name].clear();
        }

        delete this.closeWorkerAfterMs[name];
      }

      return pWaitFor(() => this.workers[name] === undefined);
    }

    for (const job of this.config.jobs) {
      this.stop(job.name);
    }

    return pWaitFor(() => Object.keys(this.workers).length === 0);
  }

  add(jobs) {
    //
    // make sure jobs is an array
    //
    if (!Array.isArray(jobs)) {
      jobs = [jobs];
    }

    const errors = [];

    for (const [i, job_] of jobs.entries()) {
      try {
        const names = [
          ...getJobNames(jobs, i),
          ...getJobNames(this.config.jobs)
        ];

        validateJob(job_, i, names, this.config);
        const job = buildJob(job_, this.config);

        this.config.jobs.push(job);
      } catch (err) {
        errors.push(err);
      }
    }

    debug('jobs added', this.config.jobs);

    // If there were any errors then throw them
    if (errors.length > 0) {
      throw combineErrors(errors);
    }
  }

  async remove(name) {
    const job = this.config.jobs.find((j) => j.name === name);
    if (!job) {
      throw new Error(`Job "${name}" does not exist`);
    }

    // make sure it also closes any open workers
    await this.stop(name);

    this.config.jobs = this.config.jobs.filter((j) => j.name !== name);
  }
}

// Expose bthreads (useful for tests)
// https://github.com/chjj/bthreads#api
Bree.threads = {
  backend: threads.backend,
  browser: threads.browser,
  location: threads.location,
  filename: threads.filename,
  dirname: threads.dirname,
  require: threads.require,
  resolve: threads.resolve,
  exit: threads.exit,
  cores: threads.cores
};

module.exports = Bree;
