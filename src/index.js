//
// NOTE: we could use `node:` prefix but it is only supported in ESM v14.13.1+ and v12.20+
//       and since this is a CJS module then it is only supported in v14.18+ and v16+
//
const fs = require('node:fs');
const EventEmitter = require('node:events');
const { pathToFileURL } = require('node:url');
const { Worker } = require('node:worker_threads');
const { join, resolve } = require('node:path');
const { debuglog } = require('node:util');
const combineErrors = require('combine-errors');
const isSANB = require('is-string-and-not-blank');
const isValidPath = require('is-valid-path');
const later = require('@breejs/later');
const pWaitFor = require('p-wait-for');
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

function omit(obj, props) {
  obj = { ...obj };
  for (const prop of props) delete obj[prop];
  return obj;
}

const debug = debuglog('bree');

class ImportError extends Error {}

class Bree extends EventEmitter {
  constructor(config) {
    super();
    this.config = {
      // We recommend using Cabin for logging
      // <https://cabinjs.com>
      logger: console,
      // Set this to `false` to prevent requiring a root directory of jobs
      // (e.g. if your jobs are not all in one directory)
      root: resolve('jobs'),
      // Set this to `true` to silence root check error log
      silenceRootCheckError: false,
      // Set this to `false` to prevent requiring a root directory of jobs
      doRootCheck: true,
      // Remove jobs upon completion
      // (set this to `true` if you want jobs to removed from array upon completion)
      // this will not remove jobs when `stop` is called
      removeCompleted: false,
      // Default timeout for jobs
      // (set this to `false` if you do not wish for a default timeout to be set)
      timeout: 0,
      // Default interval for jobs
      // (set this to `0` for no interval, and > 0 for a default interval to be set)
      interval: 0,
      // Default timezone for jobs
      // Must be a IANA string (ie. 'America/New_York', 'EST', 'UTC', etc).
      // To use the system specified timezone, set this to 'local' or 'system'.
      timezone: 'local',
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
      defaultRootIndex: 'index.js',
      defaultExtension: 'js',
      // an array of accepted extensions
      // NOTE: if you add to this array you must extend `createWorker`
      //        to deal with the conversion to acceptable files for
      //        Node Workers
      acceptedExtensions: ['.js', '.mjs'],
      // Default worker options to pass to ~`new Worker`
      // (can be overridden on a per job basis)
      // <https://nodejs.org/api/worker_threads.html#worker_threads_new_worker_filename_options>
      worker: {},
      // Custom handler to execute when error events are emitted by the workers or when they exit
      // with non-zero code
      // pass in a callback function with following signature: `(error, workerMetadata) => { // custom handling here }`
      errorHandler: null,
      // Custom handler executed when a `message` event is received from a worker.
      // A special 'done' event is also broadcasted while leaving worker shutdown logic in place.
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

    // `defaultExtension` option should not start with a period
    if (this.config.defaultExtension.indexOf('.') === 0)
      throw new Error(
        '`defaultExtension` should not start with a ".", please enter the file extension without a leading period'
      );

    // Validate timezone string
    // `.toLocaleString()` will throw a `RangeError` if `timeZone` string
    // is bogus or not supported by the environment.
    if (
      isSANB(this.config.timezone) &&
      !['local', 'system'].includes(this.config.timezone)
    ) {
      new Date().toLocaleString('ia', { timeZone: this.config.timezone });
    }

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

    // validate acceptedExtensions
    if (
      !this.config.acceptedExtensions ||
      !Array.isArray(this.config.acceptedExtensions)
    ) {
      throw new TypeError('`acceptedExtensions` must be defined and an Array');
    }

    // convert `false` logger option into noop
    // <https://github.com/breejs/bree/issues/147>
    if (this.config.logger === false)
      this.config.logger = {
        /* istanbul ignore next */
        info() {},
        /* istanbul ignore next */
        warn() {},
        /* istanbul ignore next */
        error() {}
      };

    debug('config', this.config);

    this.closeWorkerAfterMs = new Map();
    this.workers = new Map();
    this.timeouts = new Map();
    this.intervals = new Map();

    this.isSchedule = isSchedule;
    this.getWorkerMetadata = this.getWorkerMetadata.bind(this);
    this.run = this.run.bind(this);
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.add = this.add.bind(this);
    this.remove = this.remove.bind(this);
    this.removeSafeTimer = this.removeSafeTimer.bind(this);
    this.handleJobCompletion = this.handleJobCompletion.bind(this);

    this.validateJob = validateJob;
    this.getName = getName;
    this.getHumanToMs = getHumanToMs;
    this.parseValue = parseValue;

    // so plugins can extend constructor
    this.init = this.init.bind(this);

    // store whether init was successful
    this._init = false;

    debug('jobs', this.config.jobs);
  }

  async init() {
    debug('init');

    // Validate root
    // <https://nodejs.org/api/esm.html#esm_mandatory_file_extensions>
    if (
      isSANB(this.config.root) /* istanbul ignore next */ &&
      isValidPath(this.config.root)
    ) {
      const stats = await fs.promises.stat(this.config.root);
      if (!stats.isDirectory()) {
        throw new Error(`Root directory of ${this.config.root} does not exist`);
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
    debug('root', this.config.root);
    debug('doRootCheck', this.config.doRootCheck);
    debug('jobs', this.config.jobs);
    if (
      this.config.root &&
      this.config.doRootCheck &&
      (!Array.isArray(this.config.jobs) || this.config.jobs.length === 0)
    ) {
      try {
        const importPath = join(this.config.root, this.config.defaultRootIndex);
        debug('importPath', importPath);
        const importUrl = pathToFileURL(importPath).toString();
        debug('importUrl', importUrl);
        // hint: import statement expect a esm-url-string, not a file-path-string (https://github.com/breejs/bree/issues/202)
        // otherwise the following error is expected:
        // Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: Only URLs with a scheme in: file, data are supported by the default ESM loader.
        // On Windows, absolute paths must be valid file:// URLs.
        const obj = await import(importUrl);
        if (typeof obj.default !== 'object') {
          throw new ImportError(
            `Root index file missing default export at: ${importPath}`
          );
        }

        this.config.jobs = obj.default;
      } catch (err) {
        debug(err);

        //
        // NOTE: this is only applicable for Node <= 12.20.0
        //
        /* istanbul ignore next */
        if (err.message === 'Not supported') throw err;
        if (err instanceof ImportError) throw err;
        if (!this.config.silenceRootCheckError) {
          this.config.logger.error(err);
        }
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

    this.config.jobs = await Promise.all(
      this.config.jobs.map(async (job, index) => {
        try {
          const names = getJobNames(this.config.jobs, index);
          await validateJob(job, index, names, this.config);
          return buildJob(job, this.config);
        } catch (err) {
          errors.push(err);
        }
      })
    );

    // If there were any errors then throw them
    if (errors.length > 0) {
      throw combineErrors(errors);
    }

    // Otherwise set that init was called successfully
    this._init = true;
    debug('init was successful');
  }

  getWorkerMetadata(name, meta = {}) {
    debug('getWorkerMetadata', name, { meta });

    if (!this._init)
      throw new Error(
        'bree.init() was not called, see <https://github.com/breejs/bree/blob/master/UPGRADING.md#upgrading-from-v8-to-v9>'
      );

    const job = this.config.jobs.find((j) => j.name === name);
    if (!job) {
      throw new Error(`Job "${name}" does not exist`);
    }

    if (!this.config.outputWorkerMetadata && !job.outputWorkerMetadata) {
      return meta && (meta.err !== undefined || meta.message !== undefined)
        ? meta
        : undefined;
    }

    if (this.workers.has(name)) {
      const worker = this.workers.get(name);

      return {
        ...meta,
        worker: {
          isMainThread: worker.isMainThread,
          resourceLimits: worker.resourceLimits,
          threadId: worker.threadId
        }
      };
    }

    return meta;
  }

  async run(name) {
    debug('run', name);

    if (!this._init) await this.init();

    if (name) {
      const job = this.config.jobs.find((j) => j.name === name);
      if (!job) {
        throw new Error(`Job "${name}" does not exist`);
      }

      if (this.workers.has(name)) {
        this.config.logger.warn(
          new Error(`Job "${name}" is already running`),
          this.getWorkerMetadata(name)
        );
        return;
      }

      debug('starting worker', name);
      const object = {
        ...this.config.worker,
        ...job.worker,
        workerData: {
          job: {
            ...job,
            ...(job.worker ? { worker: omit(job.worker, ['env']) } : {})
          },
          ...(this.config.worker && this.config.worker.workerData
            ? this.config.worker.workerData
            : {}),
          ...(job.worker && job.worker.workerData ? job.worker.workerData : {})
        }
      };
      this.workers.set(name, this.createWorker(job.path, object));
      this.emit('worker created', name);
      debug('worker started', name);

      const prefix = `Worker for job "${name}"`;
      this.workers.get(name).on('online', () => {
        // If we specified a value for `closeWorkerAfterMs`
        // then we need to terminate it after that execution time
        const closeWorkerAfterMs = Number.isFinite(job.closeWorkerAfterMs)
          ? job.closeWorkerAfterMs
          : this.config.closeWorkerAfterMs;
        if (Number.isFinite(closeWorkerAfterMs) && closeWorkerAfterMs > 0) {
          debug('worker has close set', name, closeWorkerAfterMs);
          this.closeWorkerAfterMs.set(
            name,
            setTimeout(() => {
              /* istanbul ignore else */
              if (this.workers.has(name)) {
                debug('worker has been terminated', name);
                this.workers.get(name).terminate();
              }
            }, closeWorkerAfterMs)
          );
        }

        this.config.logger.info(
          `${prefix} online`,
          this.getWorkerMetadata(name)
        );
      });
      this.workers.get(name).on('message', (message) => {
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
          const worker = this.workers.get(name);
          worker.removeAllListeners('message');
          worker.removeAllListeners('exit');
          worker.terminate();
          this.workers.delete(name);

          this.handleJobCompletion(name);

          this.emit('worker deleted', name);
        }
      });
      // NOTE: you cannot catch messageerror since it is a Node internal
      //       (if anyone has any idea how to catch this in tests let us know)
      /* istanbul ignore next */
      this.workers.get(name).on('messageerror', (err) => {
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
      this.workers.get(name).on('error', (err) => {
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
      this.workers.get(name).on('exit', (code) => {
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

        this.workers.delete(name);

        this.handleJobCompletion(name);

        this.emit('worker deleted', name);
      });
      return;
    }

    for (const job of this.config.jobs) {
      this.run(job.name);
    }
  }

  async start(name) {
    debug('start', name);

    if (!this._init) await this.init();

    if (name) {
      const job = this.config.jobs.find((j) => j.name === name);
      if (!job) {
        throw new Error(`Job ${name} does not exist`);
      }

      if (
        this.timeouts.has(name) ||
        this.intervals.has(name) ||
        this.workers.has(name)
      ) {
        throw new Error(`Job "${name}" is already started`);
      }

      debug('job', job);

      // Check for date and if it is in the past then don't run it
      if (job.date instanceof Date) {
        debug('job date', job);
        if (job.date.getTime() < Date.now()) {
          debug('job date was in the past');
          // not throwing an error so that jobs can be set with a specifc date
          // and only run on that date then never run again without changing config
          this.config.logger.warn(
            `Job "${name}" was skipped because it was in the past.`
          );
          this.emit('job past', name);
          return;
        }

        this.timeouts.set(
          name,
          setTimeout(() => {
            this.run(name);
            if (this.isSchedule(job.interval)) {
              debug('job.interval is schedule', job);
              this.intervals.set(
                name,
                later.setInterval(
                  () => this.run(name),
                  job.interval,
                  job.timezone
                )
              );
            } else if (Number.isFinite(job.interval) && job.interval > 0) {
              debug('job.interval is finite', job);
              this.intervals.set(
                name,
                setInterval(() => this.run(name), job.interval)
              );
            } else {
              debug('job.date was scheduled to run only once', job);
            }

            this.timeouts.delete(name);
          }, job.date.getTime() - Date.now())
        );
        return;
      }

      // This is only complex because both timeout and interval can be a schedule
      if (this.isSchedule(job.timeout)) {
        debug('job timeout is schedule', job);
        this.timeouts.set(
          name,
          later.setTimeout(
            () => {
              this.run(name);
              if (this.isSchedule(job.interval)) {
                debug('job.interval is schedule', job);
                this.intervals.set(
                  name,
                  later.setInterval(
                    () => this.run(name),
                    job.interval,
                    job.timezone
                  )
                );
              } else if (Number.isFinite(job.interval) && job.interval > 0) {
                debug('job.interval is finite', job);
                this.intervals.set(
                  name,
                  setInterval(() => this.run(name), job.interval)
                );
              }

              this.timeouts.delete(name);
            },
            job.timeout,
            job.timezone
          )
        );
        return;
      }

      if (Number.isFinite(job.timeout)) {
        debug('job timeout is finite', job);
        this.timeouts.set(
          name,
          setTimeout(() => {
            this.run(name);

            if (this.isSchedule(job.interval)) {
              debug('job.interval is schedule', job);
              this.intervals.set(
                name,
                later.setInterval(
                  () => this.run(name),
                  job.interval,
                  job.timezone
                )
              );
            } else if (Number.isFinite(job.interval) && job.interval > 0) {
              debug('job.interval is finite', job.interval);
              this.intervals.set(
                name,
                setInterval(() => this.run(name), job.interval)
              );
            }

            this.timeouts.delete(name);
          }, job.timeout)
        );
      } else if (this.isSchedule(job.interval)) {
        debug('job.interval is schedule', job);
        this.intervals.set(
          name,
          later.setInterval(() => this.run(name), job.interval, job.timezone)
        );
      } else if (Number.isFinite(job.interval) && job.interval > 0) {
        debug('job.interval is finite', job);
        this.intervals.set(
          name,
          setInterval(() => this.run(name), job.interval)
        );
      }

      return;
    }

    for (const job of this.config.jobs) {
      this.start(job.name);
    }
  }

  async stop(name) {
    debug('stop', name);

    if (!this._init) await this.init();

    if (name) {
      this.removeSafeTimer('timeouts', name);
      this.removeSafeTimer('intervals', name);

      if (this.workers.has(name)) {
        this.workers.get(name).once('message', (message) => {
          if (message === 'cancelled') {
            this.config.logger.info(
              `Gracefully cancelled worker for job "${name}"`,
              this.getWorkerMetadata(name)
            );
            this.workers.get(name).terminate();
          }
        });
        this.workers.get(name).postMessage('cancel');
      }

      this.removeSafeTimer('closeWorkerAfterMs', name);

      return pWaitFor(() => !this.workers.has(name));
    }

    for (const job of this.config.jobs) {
      this.stop(job.name);
    }

    return pWaitFor(() => this.workers.size === 0);
  }

  async add(jobs) {
    debug('add', jobs);

    if (!this._init) await this.init();

    //
    // make sure jobs is an array
    //
    if (!Array.isArray(jobs)) {
      jobs = [jobs];
    }

    const errors = [];
    const addedJobs = [];

    await Promise.all(
      // handle `jobs` in case it is a Set or an Array
      // <https://stackoverflow.com/a/42624575>
      [...jobs].map(async (job_, index) => {
        try {
          const names = [
            ...getJobNames(jobs, index),
            ...getJobNames(this.config.jobs)
          ];

          await validateJob(job_, index, names, this.config);
          const job = buildJob(job_, this.config);

          addedJobs.push(job);
        } catch (err) {
          errors.push(err);
        }
      })
    );

    debug('jobs added', this.config.jobs);

    // If there were any errors then throw them
    if (errors.length > 0) {
      throw combineErrors(errors);
    }

    this.config.jobs.push(...addedJobs);
    return addedJobs;
  }

  async remove(name) {
    debug('remove', name);

    if (!this._init) await this.init();

    const job = this.config.jobs.find((j) => j.name === name);
    if (!job) {
      throw new Error(`Job "${name}" does not exist`);
    }

    // make sure it also closes any open workers
    await this.stop(name);

    this.config.jobs = this.config.jobs.filter((j) => j.name !== name);
  }

  /**
   * A friendly helper to clear safe-timers timeout and interval
   * @param {string} type
   * @param {string} name
   */
  removeSafeTimer(type, name) {
    if (this[type].has(name)) {
      const timer = this[type].get(name);

      if (typeof timer === 'object' && typeof timer.clear === 'function') {
        timer.clear();
      }

      this[type].delete(name);
    }
  }

  createWorker(filename, options) {
    return new Worker(filename, options);
  }

  handleJobCompletion(name) {
    debug('handleJobCompletion', name);

    if (!this._init)
      throw new Error(
        'bree.init() was not called, see <https://github.com/breejs/bree/blob/master/UPGRADING.md#upgrading-from-v8-to-v9>'
      );

    // remove closeWorkerAfterMs if exist
    this.removeSafeTimer('closeWorkerAfterMs', name);

    if (
      this.config.removeCompleted &&
      !this.timeouts.has(name) &&
      !this.intervals.has(name)
    ) {
      this.config.jobs = this.config.jobs.filter((j) => j.name !== name);
    }
  }
}

// plugins inspired by Dayjs
Bree.extend = (plugin, options) => {
  if (!plugin.$i) {
    // install plugin only once
    plugin(options, Bree);
    plugin.$i = true;
  }

  return Bree;
};

module.exports = Bree;
