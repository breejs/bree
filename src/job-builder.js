const { join } = require('path');
const isSANB = require('is-string-and-not-blank');
const isValidPath = require('is-valid-path');
const { boolean } = require('boolean');
const later = require('@breejs/later');
const { isSchedule, parseValue } = require('./job-utils');

later.date.localTime();

// eslint-disable-next-line complexity
const buildJob = (job, config) => {
  if (isSANB(job)) {
    const path = join(
      config.root,
      job.endsWith('.js') || job.endsWith('.mjs')
        ? job
        : `${job}.${config.defaultExtension}`
    );

    return {
      name: job,
      path,
      timeout: config.timeout,
      interval: config.interval
    };
  }

  if (typeof job === 'function') {
    const path = `(${job.toString()})()`;

    return {
      name: job.name,
      path,
      worker: { eval: true },
      timeout: config.timeout,
      interval: config.interval
    };
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
          job.name.endsWith('.js') || job.name.endsWith('.mjs')
            ? job.name
            : `${job.name}.${config.defaultExtension}`
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

  if (typeof job.timeout !== 'undefined') {
    job.timeout = parseValue(job.timeout);
  }

  if (typeof job.interval !== 'undefined') {
    job.interval = parseValue(job.interval);
  }

  // Build cron
  if (typeof job.cron !== 'undefined') {
    if (isSchedule(job.cron)) {
      job.interval = job.cron;
      // Delete job.cron;
    } else {
      job.interval = later.parse.cron(
        job.cron,
        boolean(
          typeof job.hasSeconds === 'undefined'
            ? config.hasSeconds
            : job.hasSeconds
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
    typeof job.timeout === 'undefined' &&
    typeof job.cron === 'undefined' &&
    typeof job.date === 'undefined' &&
    typeof job.interval === 'undefined'
  ) {
    job.timeout = config.timeout;
  }

  // If interval was undefined, cron was undefined,
  // and date was undefined then set the default
  // (as long as the default interval is > 0, or it was a schedule, or it was valid)
  if (
    ((Number.isFinite(config.interval) && config.interval > 0) ||
      isSchedule(config.interval)) &&
    typeof job.interval === 'undefined' &&
    typeof job.cron === 'undefined' &&
    typeof job.date === 'undefined'
  ) {
    job.interval = config.interval;
  }

  return job;
};

module.exports = buildJob;
