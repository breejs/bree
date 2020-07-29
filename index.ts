import { EventEmitter } from 'events';
import { Worker, WorkerOptions } from 'worker_threads';
import { resolve, join } from 'path';
import { statSync } from 'fs';

import combineErrors from 'combine-errors';
import cron from 'cron-validate';
import createDebug from 'debug';
import humanInterval from 'human-interval';
import isSANB from 'is-string-and-not-blank';
import later, { Schedule } from 'later';
import ms from 'ms';
import { boolean } from 'boolean';
import { setTimeout, setInterval, Timeout, Interval } from 'safe-timers';

const debug = createDebug('bree');
class Bree extends EventEmitter {
  config: BreeInstanceConfig;

  closeWorkerAfterMs: {
    [key: string]: Timeout;
  };

  workers: {
    [key: string]: Worker;
  };

  timeouts: {
    [key: string]: Timeout;
  };

  intervals: {
    [key: string]: Interval;
  };

  // eslint-disable-next-line complexity
  constructor(config: BreeInstanceOptions) {
    super();
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
      jobs: [] as any,
      // <https://bunkat.github.io/later/parsers.html#cron>
      // (can be overridden on a job basis with same prop name)
      hasSeconds: false,
      // <https://github.com/Airfooox/cron-validate>
      cronValidate: {} as any,
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
        preset: this.config.cronValidate?.preset
          ? this.config.cronValidate.preset
          : 'default',
        override: {
          ...(this.config.cronValidate?.override
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
    const names: string[] = [];

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
      ) {
        errors.push(
          new Error(
            `${prefix} cannot have both interval and cron configuration`
          )
        );
      }

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
      if (typeof job.date !== 'undefined' && !(job.date instanceof Date)) {
        errors.push(new Error(`${prefix} had an invalid Date of ${job.date}`));
      }

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

      // validate hasSeconds
      if (
        typeof job.hasSeconds !== 'undefined' &&
        typeof job.hasSeconds !== 'boolean'
      )
        errors.push(
          new Error(
            `${prefix} had hasSeconds value of ${job.hasSeconds!} (it must be a Boolean)`
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
        const preset = job.cronValidate?.preset
          ? job.cronValidate.preset
          : this.config.cronValidate?.preset
          ? this.config.cronValidate.preset
          : 'default';
        const override = {
          ...(this.config.cronValidate?.override
            ? this.config.cronValidate.override
            : {}),
          ...(job.cronValidate?.override || {}),
          useSeconds: true
        };
        this.config.jobs[i].cronValidate = {
          ...this.config.cronValidate,
          ...job.cronValidate,
          preset,
          override
        };
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
          const result = cron(
            job.cron,
            typeof job.cronValidate === 'undefined'
              ? this.config.cronValidate
              : job.cronValidate
          );
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
            // NOTE: it is always valid
            this.config.jobs[i].interval = schedule;
            // if (schedule.isValid()) {
            //   this.config.jobs[i].interval = schedule;
            // } // else {
            //   errors.push(
            //     new Error(
            //       `${prefix} had an invalid cron schedule (see <https://crontab.guru> if you need help)`
            //     )
            //   );
            // }
            // above code will never be called
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
          new Error(
            `${prefix} had an invalid closeWorkersAfterMs value of ${job.closeWorkerAfterMs} (it must be a finite number > 0)`
          )
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

  getHumanToMs(_value: string) {
    const value = humanInterval(_value);
    if (Number.isNaN(value)) return ms(_value);
    return value;
  }

  parseValue(value: boolean | number | string | Schedule) {
    if (value === false) return value;

    if (this.isSchedule(value)) return value;

    if (isSANB(value)) {
      const schedule: any = later.schedule(later.parse.text(value));
      if (schedule.isValid()) return schedule;
      value = this.getHumanToMs(value)!;
    }

    if (!Number.isFinite(value) || value < 0)
      throw new Error(
        `Value ${value} must be a finite number >= 0 or a String parseable by \`later.parse.text\` (see <https://bunkat.github.io/later/parsers.html#text> for examples)`
      );

    return value;
  }

  isSchedule(value: any) {
    return typeof value === 'object' && Array.isArray(value.schedules);
  }

  getWorkerMetadata(
    name: string,
    meta: { err?: Error; message?: string } = {}
  ) {
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
            isMainThread: (this.workers[name] as any).isMainThread,
            resourceLimits: this.workers[name].resourceLimits,
            threadId: this.workers[name].threadId
          }
        }
      : meta;
  }

  run(name?: string) {
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
      const workerOptions = {
        ...(this.config.worker ? this.config.worker : {}),
        ...(job.worker ? job.worker : {}),
        workerData: {
          job,
          ...(this.config.worker?.workerData
            ? this.config.worker.workerData
            : {}),
          ...(job.worker?.workerData ? job.worker.workerData : {})
        }
      };
      this.workers[name] = new Worker(job.path!, workerOptions as any);
      this.emit('worker created', name);
      debug('worker started', name);

      // if we specified a value for `closeWorkerAfterMs`
      // then we need to terminate it after that execution time
      const closeWorkerAfterMs = Number.isFinite(job.closeWorkerAfterMs)
        ? job.closeWorkerAfterMs ?? 0
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
      this.workers[name].on('message', (message: string) => {
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
      this.workers[name].on('messageerror', (err: Error) => {
        this.config.logger.error(
          `${prefix} had a message error`,
          this.getWorkerMetadata(name, { err })
        );
      });
      this.workers[name].on('error', (err: Error) => {
        this.config.logger.error(
          `${prefix} had an error`,
          this.getWorkerMetadata(name, { err })
        );
      });
      this.workers[name].on('exit', (code: number) => {
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

  start(name?: string) {
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
              job.interval as any
            );
          } else if (
            typeof job.interval === 'number' &&
            Number.isFinite(job.interval) &&
            job.interval > 0
          ) {
            debug('job.interval is finite', job);
            this.intervals[name] = setInterval(
              () => this.run(name),
              job.interval as any
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
              job.interval as any
            );
          } else if (
            typeof job.interval === 'number' &&
            Number.isFinite(job.interval) &&
            job.interval > 0
          ) {
            debug('job.interval is finite', job);
            this.intervals[name] = setInterval(
              () => this.run(name),
              job.interval as any
            );
          }
        }, job.timeout as any);
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
              job.interval as any
            );
          } else if (
            typeof job.interval === 'number' &&
            Number.isFinite(job.interval) &&
            job.interval > 0
          ) {
            debug('job.interval is finite', job.interval);
            this.intervals[name] = setInterval(
              () => this.run(name),
              job.interval as any
            );
          }
        }, job.timeout as any);
      } else if (this.isSchedule(job.interval)) {
        debug('job.interval is schedule', job);
        this.intervals[name] = later.setInterval(
          () => this.run(name),
          job.interval as any
        );
      } else if (
        typeof job.interval === 'number' &&
        Number.isFinite(job.interval) &&
        job.interval > 0
      ) {
        debug('job.interval is finite', job);
        this.intervals[name] = setInterval(
          () => this.run(name),
          job.interval as any
        );
      }

      return;
    }

    for (const job of this.config.jobs) {
      this.start(job.name);
    }
  }

  stop(name?: string) {
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
        this.workers[name].once('message', (message: string) => {
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
}

export default Bree;

export interface BreeLogger {
  log: (...str: any[]) => void;
  info: (...str: any[]) => void;
  error: (...str: any[]) => void;
  warn?: (...str: any[]) => void;
}

export interface CronValidate {
  preset: any;
  override: any;
}

export interface BreeInstanceConfig {
  logger: BreeLogger;
  root: string;
  timeout: number;
  interval: number;
  jobs: BreeJobOptions[];
  hasSeconds: boolean;
  cronValidate: CronValidate;
  closeWorkerAfterMs: number;
  defaultExtension: 'js' | 'mjs';
  worker: WorkerOptions;
  outputWorkerMetadata: boolean;
}

export interface BreeInstanceOptions {
  /**
   * This is the default logger. We recommend using Cabin instead of using console as your default logger.
   */
  logger?: BreeLogger;
  /**
   * Set this value to false to prevent requiring a root directory of jobs (e.g. if your jobs are not all in one directory).
   */
  root?: string;
  /**
   * Default timeout for jobs (e.g. a value of 0 means that jobs will start on boot by default unless a job has a property of timeout defined. Set this to false if you do not wish for a default value to be set for jobs. This value does not apply to jobs with a property of date.
   */
  timeout?: number;
  /**
   * Default interval for jobs (e.g. a value of 0 means that there is no interval, and a value greater than zero indicates a default interval will be set with this value). This value does not apply to jobs with a property of cron.
   */
  interval?: number;
  /**
   * Defaults to an empty Array, but if the root directory has a index.js file, then it will be used. This allows you to keep your jobs and job definition index in the same place. See Job Options below, and Usage and Examples above for more insight.
   */
  jobs?: Array<string | BreeJobOptions>;
  /**
   * This value is passed to later for parsing jobs, and can be overridden on a per job basis. See later cron parsing documentation for more insight. Note that setting this to true will automatically set cronValidate defaults to have { preset: 'default', override: { useSeconds: true } }
   */
  hasSeconds?: boolean;
  /**
   * This value is passed to cron-validate for validation of cron expressions. See the cron-validate documentation for more insight.
   */
  cronValidate?: CronValidate;
  /**
   * If you set a value greater than 0 here, then it will terminate workers after this specified time (in milliseconds). By default there is no termination done, and jobs can run for infinite periods of time.
   */
  closeWorkerAfterMs?: number;
  /**
   * This value can either be js or mjs. The default is js, and is the default extension added to jobs that are simply defined with a name and without a path. For example, if you define a job test, then it will look for /path/to/root/test.js as the file used for workers.
   */
  defaultExtension?: 'js' | 'mjs';
  /**
   * These are default options to pass when creating a new Worker instance. See the Worker class documentation for more insight.
   */
  worker?: WorkerOptions;
  /**
   * By default worker metadata is not passed to the second Object argument of logger. However if you set this to true, then logger will be invoked internally with two arguments (e.g. logger.info('...', { worker: ... })). This worker property contains isMainThread (Boolean), resourceLimits (Object), and threadId (String) properties; all of which correspond to Workers metadata. This can be overridden on a per job basis.
   */
  outputWorkerMetadata?: boolean;
}

export interface BreeJobOptions {
  /**
   * The name of the job. This should match the base file path (e.g. foo if foo.js is located at /path/to/jobs/foo.js) unless path option is specified. A value of index, index.js, and index.mjs are reserved values and cannot be used here.
   */
  name: string;
  /**
   * The path of the job used for spawning a new Worker with. If not specified, then it defaults to the value for name plus the default file extension specified under Instance Options.
   */
  path?: string;
  /**
   * Sets the duration in milliseconds before the job starts (it overrides the default inherited timeout as set in Instance Options. A value of 0 indicates it will start immediately. This value can be a Number, String, or a Boolean of false (which indicates it will NOT inherit the default timeout from Instance Options). See Job Interval and Timeout Values below for more insight into how this value is parsed.
   */
  timeout?: number | string | boolean | later.Schedule;
  /**
   * Sets the duration in milliseconds for the job to repeat itself, otherwise known as its interval (it overrides the default inherited interval as set in Instance Options). A value of 0 indicates it will not repeat and there will be no interval. If the value is greater than 0 then this value will be used as the interval. See Job Interval and Timeout Values below for more insight into how this value is parsed.
   */
  interval?: number | string | later.Schedule;
  /**
   * This must be a valid JavaScript Date (we use instance of Date for comparison). If this value is in the past, then it is not run when jobs are started (or run manually). We recommend using dayjs for creating this date, and then formatting it using the toDate() method (e.g. dayjs().add('3, 'days').toDate()). You could also use moment or any other JavaScript date library, as long as you convert the value to a Date instance here.
   */
  date?: Date;
  /**
   * A cron expression to use as the job's interval, which is validated against cron-validate and parsed by later.
   */
  cron?: string;
  /**
   * Overrides the Instance Options hasSeconds property if set. Note that setting this to true will automatically set cronValidate defaults to have { preset: 'default', override: { useSeconds: true } }
   */
  hasSeconds?: boolean;
  /**
   * Overrides the Instance Options cronValidate property if set.
   */
  cronValidate?: CronValidate;
  /**
   * Overrides the Instance Options hasSeconds property if set. Note that setting this to true will automatically set cronValidate defaults to have { preset: 'default', override: { useSeconds: true } }
   */
  closeWorkerAfterMs?: number;
  /**
   * Overrides the Instance Options worker property if set.
   */
  worker?: Worker & { workerData: any };
  /**
   * Overrides the Instance Options outputWorkerMetadata property if set.
   */
  outputWorkerMetadata?: boolean;
}
