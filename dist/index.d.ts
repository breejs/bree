/// <reference types="node" />
import { EventEmitter } from 'events';
import { Worker, WorkerOptions } from 'worker_threads';
import later, { Schedule } from 'later';
import { Timeout, Interval } from 'safe-timers';
declare class Bree extends EventEmitter {
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
  constructor(config: BreeInstanceOptions);
  getHumanToMs(_value: string): number | undefined;
  parseValue(value: boolean | number | string | Schedule): any;
  isSchedule(value: any): boolean;
  getWorkerMetadata(
    name: string,
    meta?: {
      err?: Error;
      message?: string;
    }
  ):
    | {
        err?: Error | undefined;
        message?: string | undefined;
      }
    | {
        worker: {
          isMainThread: any;
          resourceLimits: import('worker_threads').ResourceLimits | undefined;
          threadId: number;
        };
        err?: Error | undefined;
        message?: string | undefined;
      }
    | undefined;
  run(name?: string): void;
  start(name?: string): void;
  stop(name?: string): void;
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
  path: string;
  /**
   * Sets the duration in milliseconds before the job starts (it overrides the default inherited timeout as set in Instance Options. A value of 0 indicates it will start immediately. This value can be a Number, String, or a Boolean of false (which indicates it will NOT inherit the default timeout from Instance Options). See Job Interval and Timeout Values below for more insight into how this value is parsed.
   */
  timeout: number | string | boolean | later.Schedule;
  /**
   * Sets the duration in milliseconds for the job to repeat itself, otherwise known as its interval (it overrides the default inherited interval as set in Instance Options). A value of 0 indicates it will not repeat and there will be no interval. If the value is greater than 0 then this value will be used as the interval. See Job Interval and Timeout Values below for more insight into how this value is parsed.
   */
  interval: number | string | later.Schedule;
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
  worker?: Worker & {
    workerData: any;
  };
  /**
   * Overrides the Instance Options outputWorkerMetadata property if set.
   */
  outputWorkerMetadata?: boolean;
}
