const { join } = require('node:path');
const isSANB = require('is-string-and-not-blank');
const isValidPath = require('is-valid-path');
const later = require('@breejs/later');
const { boolean } = require('boolean');
const { isSchedule, parseValue, getJobPath } = require('./job-utils');

later.date.localTime();

// eslint-disable-next-line complexity
const buildJob = (job, config) => {
  if (isSANB(job)) {
    const path = join(
      config.root,
      getJobPath(job, config.acceptedExtensions, config.defaultExtension)
    );

    const jobObject = {
      name: job,
      path,
      timeout: config.timeout,
      interval: config.interval
    };
    if (isSANB(config.timezone)) {
      jobObject.timezone = config.timezone;
    }

    return jobObject;
  }

  if (typeof job === 'function') {
    const path = `(${job.toString()})()`;

    const jobObject = {
      name: job.name,
      path,
      worker: { eval: true },
      timeout: config.timeout,
      interval: config.interval
    };
    if (isSANB(config.timezone)) {
      jobObject.timezone = config.timezone;
    }

    return jobObject;
  }

  // Process job.path
  if (typeof job.path === 'function') {
    const path = `(${job.path.toString()})()`;

    job.path = path;
    job.worker = {
      eval: true,
      ...job.worker
    };
  } else {
    const path = isSANB(job.path)
      ? job.path
      : join(
          config.root,
          getJobPath(
            job.name,
            config.acceptedExtensions,
            config.defaultExtension
          )
        );

    if (isValidPath(path)) {
      job.path = path;
    } else {
      // Assume that it's a transformed eval string
      job.worker = {
        eval: true,
        ...job.worker
      };
    }
  }

  if (job.timeout !== undefined) {
    job.timeout = parseValue(job.timeout);
  }

  if (job.interval !== undefined) {
    job.interval = parseValue(job.interval);
  }

  // Build cron
  if (job.cron !== undefined) {
    if (isSchedule(job.cron)) {
      job.interval = job.cron;
      // Delete job.cron;
    } else {
      job.interval = later.parse.cron(
        job.cron,
        boolean(
          job.hasSeconds === undefined ? config.hasSeconds : job.hasSeconds
        )
      );
    }
  }

  // If timeout was undefined, cron was undefined,
  // and date was undefined then set the default
  // (as long as the default timeout is >= 0)
  if (
    Number.isFinite(config.timeout) &&
    config.timeout >= 0 &&
    job.timeout === undefined &&
    job.cron === undefined &&
    job.date === undefined &&
    job.interval === undefined
  ) {
    job.timeout = config.timeout;
  }

  // If interval was undefined, cron was undefined,
  // and date was undefined then set the default
  // (as long as the default interval is > 0, or it was a schedule, or it was valid)
  if (
    ((Number.isFinite(config.interval) && config.interval > 0) ||
      isSchedule(config.interval)) &&
    job.interval === undefined &&
    job.cron === undefined &&
    job.date === undefined
  ) {
    job.interval = config.interval;
  }

  if (isSANB(config.timezone) && !job.timezone) {
    job.timezone = config.timezone;
  }

  return job;
};

module.exports = buildJob;
