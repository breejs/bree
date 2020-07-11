const { Worker } = require('worker_threads');
const { resolve, join } = require('path');
const { statSync } = require('fs');

const combineErrors = require('combine-errors');
const cron = require('cron-validate').default;
const debug = require('debug')('bree');
const humanInterval = require('human-interval');
const isSANB = require('is-string-and-not-blank');
const later = require('later');
const ms = require('ms');
const { boolean } = require('boolean');

class Bree {
  // eslint-disable-next-line complexity
  constructor(config) {
    this.config = {
      // we recommend using Cabin for logging
      // <https://cabinjs.com>
      logger: console,
      // set this to `false` to prevent requiring a root directory of jobs
      // (e.g. if your jobs are not all in one directory)
      root: resolve('jobs'),
      // default timeout for jobs
      // (set this to `false` if you do not wish for a default timeout to be set)
      timeout: 0,
      // default interval for jobs
      // (set this to `0` for no interval, and > 0 for a default interval to be set)
      interval: 0,
      // this is an Array of your job definitions (see README for examples)
      jobs: [],
      // <https://bunkat.github.io/later/parsers.html#cron>
      // (can be overridden on a job basis with same prop name)
      hasSeconds: false,
      // <https://github.com/Airfooox/cron-validate>
      cronValidate: {},
      // if you set a value > 0 here, then it will terminate workers after this time (ms)
      closeWorkerAfterMs: 0,
      // could also be mjs if desired
      // (this is the default extension if you just specify a job's name without ".js" or ".mjs")
      defaultExtension: 'js',
      // default worker options to pass to `new Worker`
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
      //     threadId: String,
      //     workerData: Object
      //   }
      // });
      //
      outputWorkerMetadata: false,
      ...config
    };

    debug('config', this.config);

    this.closeWorkerAfterMs = {};
    this.workers = {};
    this.timeouts = {};
    this.intervals = {};

    this.getWorkerMetadata = this.getWorkerMetadata.bind(this);
    this.run = this.run.bind(this);
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);

    // validate root (sync check)
    if (isSANB(this.config.root)) {
      const stats = statSync(this.config.root);
      if (!stats.isDirectory())
        throw new Error(`Root directory of ${this.config.root} does not exist`);
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
        this.config.jobs = require(this.config.root);
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
    const names = [];

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
      const job = this.config.jobs[i];

      // support a simple string which we will transform to have a path
      if (isSANB(job)) {
        // throw an error if duplicate job names
        if (names.includes(job))
          errors.push(
            new Error(`Job #${i + 1} has a duplicate job name of ${job}`)
          );
        else names.push(job);

        if (!this.config.root) {
          errors.push(
            new Error(
              `Job #${
                i + 1
              } "${job}" requires root directory option to auto-populate path`
            )
          );
          continue;
        }

        const path = join(
          this.config.root,
          job.endsWith('.js') || job.endsWith('.mjs')
            ? job
            : `${job}.${this.config.defaultExtension}`
        );
        try {
          const stats = statSync(path);
          if (!stats.isFile())
            throw new Error(`Job #${i + 1} "${job}" path missing: ${path}`);
          this.config.jobs[i] = {
            name: job,
            path,
            timeout: this.config.timeout,
            interval: this.config.interval
          };
        } catch (err) {
          errors.push(err);
        }

        continue;
      }

      // must be a pure object
      if (typeof job !== 'object' || Array.isArray(job)) {
        errors.push(new Error(`Job #${i + 1} must be an Object`));
        continue;
      }

      // validate name
      if (!isSANB(job.name)) {
        errors.push(new Error(`Job #${i + 1} must have a non-empty name`));
        delete job.name;
      }

      // use a prefix for errors
      const prefix = `Job #${i + 1} named "${job.name || ''}"`;

      if (!isSANB(job.path) && !this.config.root) {
        errors.push(
          new Error(
            `${prefix} requires root directory option to auto-populate path`
          )
        );
      } else {
        // validate path
        const path = isSANB(job.path)
          ? job.path
          : job.name
          ? join(
              this.config.root,
              job.name.endsWith('.js') || job.name.endsWith('.mjs')
                ? job.name
                : `${job.name}.${this.config.defaultExtension}`
            )
          : false;
        if (path) {
          try {
            const stats = statSync(path);
            // eslint-disable-next-line max-depth
            if (!stats.isFile())
              throw new Error(`${prefix} path missing: ${path}`);
            // eslint-disable-next-line max-depth
            if (!isSANB(job.path)) this.config.jobs[i].path = path;
          } catch (err) {
            errors.push(err);
          }
        } else {
          errors.push(new Error(`${prefix} path missing`));
        }
      }

      // don't allow users to mix interval AND cron
      if (
        typeof job.interval !== 'undefined' &&
        typeof job.cron !== 'undefined'
      )
        errors.push(
          new Error(
            `${prefix} cannot have both interval and cron configuration`
          )
        );

      // don't allow users to mix timeout AND date
      if (typeof job.timeout !== 'undefined' && typeof job.date !== 'undefined')
        errors.push(new Error(`${prefix} cannot have both timeout and date`));

      // throw an error if duplicate job names
      if (job.name && names.includes(job.name))
        errors.push(
          new Error(`${prefix} has a duplicate job name of ${job.name}`)
        );
      else if (job.name) names.push(job.name);

      // validate date
      if (typeof job.date !== 'undefined' && !(job.date instanceof Date))
        errors.push(new Error(`${prefix} had an invalid Date of ${job.date}`));

      // validate timeout
      if (typeof job.timeout !== 'undefined') {
        try {
          this.config.jobs[i].timeout = this.parseValue(job.timeout);
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
          this.config.jobs[i].interval = this.parseValue(job.interval);
        } catch (err) {
          errors.push(
            combineErrors([
              new Error(`${prefix} had an invalid interval of ${job.interval}`),
              err
            ])
          );
        }
      }

      // validate cron
      if (typeof job.cron !== 'undefined') {
        if (this.isSchedule(job.cron)) {
          this.config.jobs[i].interval = job.cron;
          // delete this.config.jobs[i].cron;
        } else {
          //
          // validate cron pattern
          // (must support patterns such as `* * L * *` and `0 0/5 14 * * ?` (and aliases too)
          //
          // TODO: <https://github.com/Airfooox/cron-validate/issues/67>
          //
          const result = cron(job.cron, this.cronValidate);
          if (result.isValid()) {
            const schedule = later.schedule(
              later.parse.cron(
                job.cron,
                boolean(
                  typeof job.hasSeconds === 'undefined'
                    ? this.config.hasSeconds
                    : job.hasSeconds
                )
              )
            );
            if (schedule.isValid()) {
              this.config.jobs[i].interval = schedule;
              // delete this.config.jobs[i].cron;
            } else {
              errors.push(
                new Error(
                  `${prefix} had an invalid cron schedule (see <https://crontab.guru> if you need help)`
                )
              );
            }
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
        (!Number.isFinite(job.closeWorkerAfterMs) ||
          job.closeWorkerAfterMs <= 0)
      )
        errors.push(
          `${prefix} had an invalid closeWorkerAfterMs value of ${job.closeWorkerAfterMs} (it must be a finite number > 0`
        );

      // if timeout was undefined, cron was undefined,
      // and date was undefined then set the default
      // (as long as the default timeout is >= 0)
      if (
        Number.isFinite(this.config.timeout) &&
        this.config.timeout >= 0 &&
        typeof this.config.jobs[i].timeout === 'undefined' &&
        typeof job.cron === 'undefined' &&
        typeof job.date === 'undefined'
      )
        this.config.jobs[i].timeout = this.config.timeout;

      // if interval was undefined, cron was undefined,
      // and date was undefined then set the default
      // (as long as the default interval is > 0)
      if (
        Number.isFinite(this.config.interval) &&
        this.config.interval > 0 &&
        typeof this.config.jobs[i].interval === 'undefined' &&
        typeof job.cron === 'undefined' &&
        typeof job.date === 'undefined'
      )
        this.config.jobs[i].interval = this.config.interval;
    }

    // don't allow a job to have the `index` file name
    if (
      names.includes('index') ||
      names.includes('index.js') ||
      names.includes('index.mjs')
    )
      errors.push(
        new Error(
          'You cannot use the reserved job name of "index", "index.js", nor "index.mjs"'
        )
      );

    debug('this.config.jobs', this.config.jobs);

    // if there were any errors then throw them
    if (errors.length > 0) throw combineErrors(errors);
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
      if (schedule.isValid()) return schedule;
      value = this.getHumanToMs(value);
    }

    if (!Number.isFinite(value) || value < 0)
      throw new Error(
        `Value ${value} must be a finite number >= 0 or a String parseable by \`later.parse.text\` (see <https://bunkat.github.io/later/parsers.html#text> for examples)`
      );

    return value;
  }

  isSchedule(value) {
    return typeof value === 'object' && Array.isArray(value.schedules);
  }

  getWorkerMetadata(name, meta = {}) {
    const job = this.config.jobs.find((j) => j.name === name);
    if (!job) throw new Error(`Job "${name}" does not exist`);
    if (!this.config.outputWorkerMetadata && !job.outputWorkerMetadata) return;
    return this.workers[name]
      ? {
          ...meta,
          worker: {
            isMainThread: this.workers[name].isMainThread,
            resourceLimits: this.workers[name].resourceLimits,
            threadId: this.workers[name].threadId,
            workerData: this.workers[name].workerData
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
        return this.config.logger.error(
          new Error(`Job "${name}" is already running`),
          this.getWorkerMetadata(name)
        );
      debug('starting worker', name);
      this.workers[name] = new Worker(job.path, {
        ...(this.config.worker ? this.config.worker : {}),
        ...(job.worker ? job.worker : {}),
        workerData: {
          job,
          ...(this.config.worker && this.config.worker.workerData
            ? this.config.worker.workerData
            : {}),
          ...(job.worker && job.worker.workerData ? job.worker.workerData : {})
        }
      });
      debug('worker started', name);

      // if we specified a value for `closeWorkerAfterMs`
      // then we need to terminate it after that execution time
      const closeWorkerAfterMs = Number.isFinite(job.closeWorkerAfterMs)
        ? job.closeWorkerAfterMs
        : this.config.closeWorkerAfterMs;
      if (Number.isFinite(closeWorkerAfterMs) && closeWorkerAfterMs > 0) {
        debug('worker has close set', name, closeWorkerAfterMs);
        this.closeWorkerAfterMs[name] = setTimeout(() => {
          this.workers[name].terminate();
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
        return this.config.logger.error(
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
        else clearTimeout(this.timeouts[name]);
        delete this.timeouts[name];
      }

      if (this.intervals[name]) {
        if (
          typeof this.intervals[name] === 'object' &&
          typeof this.intervals[name].clear === 'function'
        )
          this.intervals[name].clear();
        else clearInterval(this.intervals[name]);
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
        clearTimeout(this.closeWorkerAfterMs[name]);
        delete this.closeWorkerAfterMs[name];
      }

      return;
    }

    for (const job of this.config.jobs) {
      this.stop(job.name);
    }
  }
}

module.exports = Bree;
