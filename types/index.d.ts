// Definitions by: Taylor Schley <https://github.com/shadowgate15>

import { EventEmitter } from 'node:events';
import { WorkerOptions, Worker } from 'node:worker_threads';
import { Timeout, Interval } from 'safe-timers';

export = Bree;

declare class Bree extends EventEmitter {
  config: Bree.BreeConfigs;

  closeWorkerAfterMs: Map<string, Timeout>;
  workers: Map<string, Worker>;
  timeouts: Map<string, Timeout>;
  intervals: Map<string, Interval>;

  isSchedule: (value: any) => boolean;
  getWorkerMetadata: (
    name: string,
    meta?: Record<string, unknown>
  ) => Record<string, unknown>;

  run: (name?: string) => void;

  start: (name?: string) => void;
  stop: (name?: string) => Promise<void>;
  add: (
    jobs:
      | string
      | (() => void)
      | Bree.JobOptions
      | Array<string | (() => void) | Bree.JobOptions>
  ) => void;

  remove: (name: string) => Promise<void>;

  removeSafeTimer: (type: string, name: string) => void;

  validateJob: (
    job: string | (() => void) | Bree.JobOptions,
    i: number,
    names: string[],
    config: Bree.BreeOptions
  ) => void;

  getName: (job: string | Record<string, unknown> | (() => void)) => string;

  getHumanToMs: (_value: string) => number;
  parseValue: (
    value: boolean | string | number | Record<string, unknown>
  ) => number | boolean | Record<string, unknown>;

  createWorker: (filename: string, options: Partial<WorkerOptions>) => Worker;

  handleJobCompletion: (name: string) => void;

  constructor(config?: Bree.BreeOptions);
}

declare namespace Bree {
  interface Job {
    name: string;
    path: string | (() => void);
    timeout: number | string | boolean;
    interval: number | string;
    date?: Date;
    cron?: string;
    hasSeconds?: boolean;
    cronValidate?: Record<string, unknown>;
    closeWorkerAfterMs?: number;
    worker?: Partial<WorkerOptions>;
    outputWorkerMetadata?: boolean;
    timezone?: string;
  }

  type JobOptions = Required<Pick<Job, 'name'>> & Partial<Omit<Job, 'name'>>;

  interface BreeConfigs {
    logger: Record<string, unknown>;
    root: string | boolean;
    silenceRootCheckError: boolean;
    doRootCheck: boolean;
    removeCompleted: boolean;
    timeout: number | boolean;
    interval: number;
    timezone: string;
    jobs: Job[];
    hasSeconds: boolean;
    cronValidate: Record<string, unknown>;
    closeWorkerAfterMs: number;
    defaultExtension: string;
    acceptedExtensions: string[];
    worker: WorkerOptions;
    errorHandler?: (error: any, workerMetadata: any) => void;
    workerMessageHandler?: (message: any, workerMetadata: any) => void;
    outputWorkerMetadata: boolean;
  }

  type BreeOptions = Partial<BreeConfigs> & {
    jobs?: Array<string | (() => void) | JobOptions>;
  };

  type PluginFunc<T = unknown> = (options: T, c: typeof Bree) => void;

  function extend<T = unknown>(plugin: PluginFunc<T>, options?: T): Bree;
}
