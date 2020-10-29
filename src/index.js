const EventEmitter = require('events');
const fs = require('fs');
const { resolve, join } = require('path');

const combineErrors = require('combine-errors');
const cron = require('cron-validate');
const debug = require('debug')('bree');
const humanInterval = require('human-interval');
const isSANB = require('is-string-and-not-blank');
const isValidPath = require('is-valid-path');
const later = require('@breejs/later');
const ms = require('ms');
const threads = require('bthreads');
const { boolean } = require('boolean');
const { setTimeout, setInterval } = require('safe-timers');

// bthreads requires us to do this for web workers (see bthreads docs for insight)
threads.Buffer = Buffer;

// instead of `threads.browser` checks below, we previously used this boolean
// const hasFsStatSync = typeof fs === 'object' && typeof fs.statSync === 'function';

class Bree extends EventEmitter {
  constructor(config) {
    super();
    this.config = {
      // we recommend using Cabin for logging
      // <https://cabinjs.com>
      logger: console,
      // set this to `false` to prevent requiring a root directory of jobs
      // (e.g. if your jobs are not all in one directory)
      root: threads.browser
        ? /* istanbul ignore next */
          threads.resolve('jobs')
        : resolve('jobs'),
      // default timeout for jobs
      // (set this to `false` if you do not wish for a default timeout to be set)
      timeout: 0,
      // default interval for jobs
      // (set this to `0` for no interval, and > 0 for a default interval to be set)
      interval: 0,
      // this is an Array of your job definitions (see README for examples)
      jobs: [],
      // <https://breejs.github.io/later/parsers.html#cron>
      // (can be overridden on a job basis with same prop name)
      hasSeconds: false,
      // <https://github.com/Airfooox/cron-validate>
      cronValidate: {},
      // if you set a value > 0 here, then it will terminate workers after this time (ms)
      closeWorkerAfterMs: 0,
      // could also be mjs if desired
      // (this is the default extension if you just specify a job's name without ".js" or ".mjs")
      defaultExtension: 'js',
      // default worker options to pass to ~`new Worker`~ `new threads.Worker`
      // (can be overridden on a per job basis)
      // <https://nodejs.org/api/worker_threads.html#worker_threads_new_worker_filename_options>
      worker: {},
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
    if (this.config.hasSeconds)
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

    debug('config', this.config);

    this.closeWorkerAfterMs = {};
    this.workers = {};
    this.timeouts = {};
    this.intervals = {};

    this.validateJob = this.validateJob.bind(this);
    this.getWorkerMetadata = this.getWorkerMetadata.bind(this);
    this.run = this.run.bind(this);
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.add = this.add.bind(this);
    this.remove = this.remove.bind(this);

    // validate root (sync check)
    if (isSANB(this.config.root)) {
      /* istanbul ignore next */
      if (!threads.browser && isValidPath(this.config.root)) {
        const stats = fs.statSync(this.config.root);
        if (!stats.isDirectory())
          throw new Error(
            `Root directory of ${this.config.root} does not exist`
          );
      }
    }

    // validate timeout
    this.config.timeout = this.parseValue(this.config.timeout);
    debug('timeout', this.config.timeout);

    // validate interval
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
    if (!Array.isArray(this.config.jobs))
      throw new Error('Jobs must be an Array');

    // provide human-friendly errors for complex configurations
    const errors = [];

    /*
    jobs = [
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
        this.config.jobs[i] = this.validateJob(this.config.jobs[i], i);
      } catch (err) {
        errors.push(err);
      }
    }

    // if there were any errors then throw them
    if (errors.length > 0) throw combineErrors(errors);

    debug('this.config.jobs', this.config.jobs);
  }

  getName(job) {
    if (isSANB(job)) return job;
    if (typeof job === 'object' && isSANB(job.name)) return job.name;
    if (typeof job === 'function' && isSANB(job.name)) return job.name;
  }

  // eslint-disable-next-line complexity
  validateJob(job, i, isAdd = false) {
    const errors = [];
    const names = [];

    if (isAdd) {
      const name = this.getName(job);
      if (name) names.push(name);
      else errors.push(new Error(`Job #${i + 1} is missing a name`));
    }

    for (let j = 0; j < this.config.jobs.length; j++) {
      const name = this.getName(this.config.jobs[j]);
      if (!name) {
        errors.push(new Error(`Job #${i + 1} is missing a name`));
        continue;
      }

      // throw an error if duplicate job names
      if (names.includes(name))
        errors.push(
          new Error(`Job #${j + 1} has a duplicate job name of ${job}`)
        );

      names.push(name);
    }

    if (errors.length > 0) throw combineErrors(errors);

    // support a simple string which we will transform to have a path
    if (isSANB(job)) {
      // don't allow a job to have the `index` file name
      if (['index', 'index.js', 'index.mjs'].includes(job))
        throw new Error(
          'You cannot use the reserved job name of "index", "index.js", nor "index.mjs"'
        );

      if (!this.config.root) {
        errors.push(
          new Error(
            `Job #${
              i + 1
            } "${job}" requires root directory option to auto-populate path`
          )
        );
        throw combineErrors(errors);
      }

      const path = join(
        this.config.root,
        job.endsWith('.js') || job.endsWith('.mjs')
          ? job
          : `${job}.${this.config.defaultExtension}`
      );

      /* istanbul ignore next */
      if (!threads.browser) {
        const stats = fs.statSync(path);
        if (!stats.isFile())
          throw new Error(`Job #${i + 1} "${job}" path missing: ${path}`);
      }

      return {
        name: job,
        path,
        timeout: this.config.timeout,
        interval: this.config.interval
      };
    }

    // job is a function
    if (typeof job === 'function') {
      const path = `(${job.toString()})()`;
      // can't be a built-in or bound function
      if (path.includes('[native code]'))
        errors.push(
          new Error(`Job #${i + 1} can't be a bound or built-in function`)
        );

      if (errors.length > 0) throw combineErrors(errors);

      return {
        name: job.name,
        path,
        worker: { eval: true },
        timeout: this.config.timeout,
        interval: this.config.interval
      };
    }

    // use a prefix for errors
    const prefix = `Job #${i + 1} named "${job.name}"`;

    if (typeof job.path === 'function') {
      const path = `(${job.path.toString()})()`;

      // can't be a built-in or bound function
      if (path.includes('[native code]'))
        errors.push(
          new Error(`Job #${i + 1} can't be a bound or built-in function`)
        );

      job.path = path;
      job.worker = {
        eval: true,
        ...job.worker
      };
    } else if (!isSANB(job.path) && !this.config.root) {
      errors.push(
        new Error(
          `${prefix} requires root directory option to auto-populate path`
        )
      );
    } else {
      // validate path
      const path = isSANB(job.path)
        ? job.path
        : join(
            this.config.root,
            job.name.endsWith('.js') || job.name.endsWith('.mjs')
              ? job.name
              : `${job.name}.${this.config.defaultExtension}`
          );
      if (isValidPath(path)) {
        try {
          /* istanbul ignore next */
          if (!threads.browser) {
            const stats = fs.statSync(path);
            // eslint-disable-next-line max-depth
            if (!stats.isFile())
              throw new Error(`${prefix} path missing: ${path}`);
          }

          if (!isSANB(job.path)) job.path = path;
        } catch (err) {
          errors.push(err);
        }
      } else {
        // assume that it's a transformed eval string
        job.worker = {
          eval: true,
          ...job.worker
        };
      }
    }

    // don't allow users to mix interval AND cron
    if (
      typeof job.interval !== 'undefined' &&
      typeof job.cron !== 'undefined'
    ) {
      errors.push(
        new Error(`${prefix} cannot have both interval and cron configuration`)
      );
    }

    // don't allow users to mix timeout AND date
    if (typeof job.timeout !== 'undefined' && typeof job.date !== 'undefined')
      errors.push(new Error(`${prefix} cannot have both timeout and date`));

    // don't allow a job to have the `index` file name
    if (['index', 'index.js', 'index.mjs'].includes(job.name)) {
      errors.push(
        new Error(
          'You cannot use the reserved job name of "index", "index.js", nor "index.mjs"'
        )
      );

      throw combineErrors(errors);
    }

    // validate date
    if (typeof job.date !== 'undefined' && !(job.date instanceof Date))
      errors.push(new Error(`${prefix} had an invalid Date of ${job.date}`));

    // validate timeout
    if (typeof job.timeout !== 'undefined') {
      try {
        job.timeout = this.parseValue(job.timeout);
      } catch (err) {
        errors.push(
          combineErrors([
            new Error(`${prefix} had an invalid timeout of ${job.timeout}`),
            err
          ])
        );
      }
    }

    // validate interval
    if (typeof job.interval !== 'undefined') {
      try {
        job.interval = this.parseValue(job.interval);
      } catch (err) {
        errors.push(
          combineErrors([
            new Error(`${prefix} had an invalid interval of ${job.interval}`),
            err
          ])
        );
      }
    }

    // validate hasSeconds
    if (
      typeof job.hasSeconds !== 'undefined' &&
      typeof job.hasSeconds !== 'boolean'
    )
      errors.push(
        new Error(
          `${prefix} had hasSeconds value of ${job.hasSeconds} (it must be a Boolean)`
        )
      );

    // validate cronValidate
    if (
      typeof job.cronValidate !== 'undefined' &&
      typeof job.cronValidate !== 'object'
    )
      errors.push(
        new Error(
          `${prefix} had cronValidate value set, but it must be an Object`
        )
      );

    // if `hasSeconds` was `true` then set `cronValidate` and inherit any existing options
    if (job.hasSeconds) {
      const preset =
        job.cronValidate && job.cronValidate.preset
          ? job.cronValidate.preset
          : this.config.cronValidate && this.config.cronValidate.preset
          ? this.config.cronValidate.preset
          : 'default';
      const override = {
        ...(this.config.cronValidate && this.config.cronValidate.override
          ? this.config.cronValidate.override
          : {}),
        ...(job.cronValidate && job.cronValidate.override
          ? job.cronValidate.override
          : {}),
        useSeconds: true
      };
      job.cronValidate = {
        ...this.config.cronValidate,
        ...job.cronValidate,
        preset,
        override
      };
    }

    // validate cron
    if (typeof job.cron !== 'undefined') {
      if (this.isSchedule(job.cron)) {
        job.interval = job.cron;
        // delete job.cron;
      } else {
        //
        // validate cron pattern
        // (must support patterns such as `* * L * *` and `0 0/5 14 * * ?` (and aliases too)
        //
        //  <https://github.com/Airfooox/cron-validate/issues/67>
        //
        const result = cron(
          job.cron,
          typeof job.cronValidate === 'undefined'
            ? this.config.cronValidate
            : job.cronValidate
        );
        if (result.isValid()) {
          job.interval = later.parse.cron(
            job.cron,
            boolean(
              typeof job.hasSeconds === 'undefined'
                ? this.config.hasSeconds
                : job.hasSeconds
            )
          );
          // NOTE: it is always valid
          // const schedule = later.schedule(
          //   later.parse.cron(
          //     job.cron,
          //     boolean(
          //       typeof job.hasSeconds === 'undefined'
          //         ? this.config.hasSeconds
          //         : job.hasSeconds
          //     )
          //   )
          // );
          // if (schedule.isValid()) {
          //   job.interval = schedule;
          // } // else {
          //   errors.push(
          //     new Error(
          //       `${prefix} had an invalid cron schedule (see <https://crontab.guru> if you need help)`
          //     )
          //   );
          // }
        } else {
          for (const message of result.getError()) {
            errors.push(
              new Error(`${prefix} had an invalid cron pattern: ${message}`)
            );
          }
        }
      }
    }

    // validate closeWorkerAfterMs
    if (
      typeof job.closeWorkerAfterMs !== 'undefined' &&
      (!Number.isFinite(job.closeWorkerAfterMs) || job.closeWorkerAfterMs <= 0)
    )
      errors.push(
        new Error(
          `${prefix} had an invalid closeWorkersAfterMs value of ${job.closeWorkersAfterMs} (it must be a finite number > 0)`
        )
      );

    if (errors.length > 0) throw combineErrors(errors);

    // if timeout was undefined, cron was undefined,
    // and date was undefined then set the default
    // (as long as the default timeout is >= 0)
    if (
      Number.isFinite(this.config.timeout) &&
      this.config.timeout >= 0 &&
      typeof job.timeout === 'undefined' &&
      typeof job.cron === 'undefined' &&
      typeof job.date === 'undefined'
    )
      job.timeout = this.config.timeout;

    // if interval was undefined, cron was undefined,
    // and date was undefined then set the default
    // (as long as the default interval is > 0, or it was a schedule, or it was valid)
    if (
      ((Number.isFinite(this.config.interval) && this.config.interval > 0) ||
        this.isSchedule(this.config.interval)) &&
      typeof job.interval === 'undefined' &&
      typeof job.cron === 'undefined' &&
      typeof job.date === 'undefined'
    )
      job.interval = this.config.interval;

    return job;
  }

  getHumanToMs(_value) {
    const value = humanInterval(_value);
    if (Number.isNaN(value)) return ms(_value);
    return value;
  }

  parseValue(value) {
    if (value === false) return value;

    if (this.isSchedule(value)) return value;

    if (isSANB(value)) {
      const schedule = later.schedule(later.parse.text(value));
      if (schedule.isValid()) return later.parse.text(value);
      value = this.getHumanToMs(value);
    }

    if (!Number.isFinite(value) || value < 0)
      throw new Error(
        `Value ${value} must be a finite number >= 0 or a String parseable by \`later.parse.text\` (see <https://breejs.github.io/later/parsers.html#text> for examples)`
      );

    return value;
  }

  isSchedule(value) {
    return typeof value === 'object' && Array.isArray(value.schedules);
  }

  getWorkerMetadata(name, meta = {}) {
    const job = this.config.jobs.find((j) => j.name === name);
    if (!job) throw new Error(`Job "${name}" does not exist`);
    if (!this.config.outputWorkerMetadata && !job.outputWorkerMetadata)
      return meta &&
        (typeof meta.err !== 'undefined' || typeof meta.message !== 'undefined')
        ? meta
        : undefined;
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
      if (!job) throw new Error(`Job "${name}" does not exist`);
      if (this.workers[name])
        return this.config.logger.warn(
          new Error(`Job "${name}" is already running`),
          this.getWorkerMetadata(name)
        );
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

      // if we specified a value for `closeWorkerAfterMs`
      // then we need to terminate it after that execution time
      const closeWorkerAfterMs = Number.isFinite(job.closeWorkerAfterMs)
        ? job.closeWorkerAfterMs
        : this.config.closeWorkerAfterMs;
      if (Number.isFinite(closeWorkerAfterMs) && closeWorkerAfterMs > 0) {
        debug('worker has close set', name, closeWorkerAfterMs);
        this.closeWorkerAfterMs[name] = setTimeout(() => {
          if (this.workers[name]) {
            this.workers[name].terminate();
          }
        }, closeWorkerAfterMs);
      }

      const prefix = `Worker for job "${name}"`;
      this.workers[name].on('online', () => {
        this.config.logger.info(
          `${prefix} online`,
          this.getWorkerMetadata(name)
        );
      });
      this.workers[name].on('message', (message) => {
        if (message === 'done') {
          this.config.logger.info(
            `${prefix} signaled completion`,
            this.getWorkerMetadata(name)
          );
          this.workers[name].removeAllListeners('message');
          this.workers[name].removeAllListeners('exit');
          this.workers[name].terminate();
          delete this.workers[name];
          return;
        }

        this.config.logger.info(
          `${prefix} sent a message`,
          this.getWorkerMetadata(name, { message })
        );
      });
      // NOTE: you cannot catch messageerror since it is a Node internal
      //       (if anyone has any idea how to catch this in tests let us know)
      /* istanbul ignore next */
      this.workers[name].on('messageerror', (err) => {
        this.config.logger.error(
          `${prefix} had a message error`,
          this.getWorkerMetadata(name, { err })
        );
      });
      this.workers[name].on('error', (err) => {
        this.config.logger.error(
          `${prefix} had an error`,
          this.getWorkerMetadata(name, { err })
        );
      });
      this.workers[name].on('exit', (code) => {
        this.config.logger[code === 0 ? 'info' : 'error'](
          `${prefix} exited with code ${code}`,
          this.getWorkerMetadata(name)
        );
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
      if (!job) throw new Error(`Job ${name} does not exist`);
      if (this.timeouts[name] || this.intervals[name])
        return this.config.logger.warn(
          new Error(`Job "${name}" is already started`)
        );

      debug('job', job);

      // check for date and if it is in the past then don't run it
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
          }
        }, job.date.getTime() - Date.now());
        return;
      }

      // this is only complex because both timeout and interval can be a schedule
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

  stop(name) {
    if (name) {
      if (this.timeouts[name]) {
        if (
          typeof this.timeouts[name] === 'object' &&
          typeof this.timeouts[name].clear === 'function'
        )
          this.timeouts[name].clear();
        delete this.timeouts[name];
      }

      if (this.intervals[name]) {
        if (
          typeof this.intervals[name] === 'object' &&
          typeof this.intervals[name].clear === 'function'
        )
          this.intervals[name].clear();
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
            delete this.workers[name];
          }
        });
        this.workers[name].postMessage('cancel');
      }

      if (this.closeWorkerAfterMs[name]) {
        if (
          typeof this.closeWorkerAfterMs[name] === 'object' &&
          typeof this.closeWorkerAfterMs[name].clear === 'function'
        )
          this.closeWorkerAfterMs[name].clear();
        delete this.closeWorkerAfterMs[name];
      }

      return;
    }

    for (const job of this.config.jobs) {
      this.stop(job.name);
    }
  }

  add(jobs) {
    //
    // make sure jobs is an array
    //
    if (!Array.isArray(jobs)) jobs = [jobs];

    const errors = [];

    for (const [i, job_] of jobs.entries()) {
      try {
        const job = this.validateJob(job_, i, true);
        this.config.jobs.push(job);
      } catch (err) {
        errors.push(err);
      }
    }

    debug('jobs added', this.config.jobs);

    // if there were any errors then throw them
    if (errors.length > 0) throw combineErrors(errors);
  }

  remove(name) {
    const job = this.config.jobs.find((j) => j.name === name);
    if (!job) throw new Error(`Job "${name}" does not exist`);

    this.config.jobs = this.config.jobs.filter((j) => j.name !== name);

    // make sure it also closes any open workers
    this.stop(name);
  }
}

// expose bthreads (useful for tests)
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
