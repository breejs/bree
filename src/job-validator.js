const fs = require('fs');
const { join } = require('path');
const combineErrors = require('combine-errors');
const cron = require('cron-validate');
const isSANB = require('is-string-and-not-blank');
const isValidPath = require('is-valid-path');

const { getName, isSchedule, parseValue } = require('./job-utils');

const validateReservedJobName = (name) => {
  // Don't allow a job to have the `index` file name
  if (['index', 'index.js', 'index.mjs'].includes(name)) {
    return new Error(
      'You cannot use the reserved job name of "index", "index.js", nor "index.mjs"'
    );
  }
};

const validateStringJob = async (job, i, config) => {
  const errors = [];

  const jobNameError = validateReservedJobName(job);
  if (jobNameError) {
    throw jobNameError;
  }

  if (!config.root) {
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
    config.root,
    config.acceptedExtensions.some((ext) => job.endsWith(ext))
      ? job
      : `${job}.${config.defaultExtension}`
  );

  const stats = await fs.promises.stat(path);
  if (!stats.isFile()) {
    throw new Error(`Job #${i + 1} "${job}" path missing: ${path}`);
  }
};

const validateFunctionJob = (job, i) => {
  const errors = [];

  const path = `(${job.toString()})()`;
  // Can't be a built-in or bound function
  if (path.includes('[native code]')) {
    errors.push(
      new Error(`Job #${i + 1} can't be a bound or built-in function`)
    );
  }

  if (errors.length > 0) {
    throw combineErrors(errors);
  }
};

const validateJobPath = async (job, prefix, config) => {
  const errors = [];

  if (typeof job.path === 'function') {
    const path = `(${job.path.toString()})()`;

    // Can't be a built-in or bound function
    if (path.includes('[native code]')) {
      errors.push(new Error(`${prefix} can't be a bound or built-in function`));
    }
  } else if (!isSANB(job.path) && !config.root) {
    errors.push(
      new Error(
        `${prefix} requires root directory option to auto-populate path`
      )
    );
  } else {
    // Validate path
    const path = isSANB(job.path)
      ? job.path
      : join(
          config.root,
          config.acceptedExtensions.some((ext) => job.name.endsWith(ext))
            ? job.name
            : `${job.name}.${config.defaultExtension}`
        );
    if (isValidPath(path)) {
      try {
        const stats = await fs.promises.stat(path);
        if (!stats.isFile()) {
          throw new Error(`${prefix} path missing: ${path}`);
        }
      } catch (err) {
        /* istanbul ignore next */
        errors.push(err);
      }
    }
  }

  return errors;
};

const cronValidateWithSeconds = (job, config) => {
  const preset =
    job.cronValidate && job.cronValidate.preset
      ? job.cronValidate.preset
      : config.cronValidate && config.cronValidate.preset
      ? config.cronValidate.preset
      : 'default';
  const override = {
    ...(config.cronValidate && config.cronValidate.override
      ? config.cronValidate.override
      : {}),
    ...(job.cronValidate && job.cronValidate.override
      ? job.cronValidate.override
      : {}),
    useSeconds: true
  };

  return {
    ...config.cronValidate,
    ...job.cronValidate,
    preset,
    override
  };
};

const validateCron = (job, prefix, config) => {
  const errors = [];

  if (!isSchedule(job.cron)) {
    // If `hasSeconds` was `true` then set `cronValidate` and inherit any existing options
    const cronValidate = job.hasSeconds
      ? cronValidateWithSeconds(job, config)
      : job.cronValidate || config.cronValidate;

    //
    // validate cron pattern
    // (must support patterns such as `* * L * *` and `0 0/5 14 * * ?` (and aliases too)
    //
    //  <https://github.com/Airfooox/cron-validate/issues/67>
    //
    const result = cron(job.cron, cronValidate);

    if (!result.isValid()) {
      // NOTE: it is always valid
      // const schedule = later.schedule(
      //   later.parse.cron(
      //     job.cron,
      //     boolean(
      //       typeof job.hasSeconds === 'undefined'
      //         ? config.hasSeconds
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

      for (const message of result.getError()) {
        errors.push(
          new Error(`${prefix} had an invalid cron pattern: ${message}`)
        );
      }
    }
  }

  return errors;
};

const validateJobName = (job, i, reservedNames) => {
  const errors = [];
  const name = getName(job);

  if (!name) {
    errors.push(new Error(`Job #${i + 1} is missing a name`));
  }

  // Throw an error if duplicate job names
  if (reservedNames.includes(name)) {
    errors.push(
      new Error(`Job #${i + 1} has a duplicate job name of ${getName(job)}`)
    );
  }

  return errors;
};

// eslint-disable-next-line complexity
const validate = async (job, i, names, config) => {
  const errors = validateJobName(job, i, names);

  if (errors.length > 0) {
    throw combineErrors(errors);
  }

  // Support a simple string which we will transform to have a path
  if (isSANB(job)) {
    return validateStringJob(job, i, config);
  }

  // Job is a function
  if (typeof job === 'function') {
    return validateFunctionJob(job, i);
  }

  // Use a prefix for errors
  const prefix = `Job #${i + 1} named "${job.name}"`;

  errors.push(...(await validateJobPath(job, prefix, config)));

  // Don't allow users to mix interval AND cron
  if (typeof job.interval !== 'undefined' && typeof job.cron !== 'undefined') {
    errors.push(
      new Error(`${prefix} cannot have both interval and cron configuration`)
    );
  }

  // Don't allow users to mix timeout AND date
  if (typeof job.timeout !== 'undefined' && typeof job.date !== 'undefined') {
    errors.push(new Error(`${prefix} cannot have both timeout and date`));
  }

  const jobNameError = validateReservedJobName(job.name);
  if (jobNameError) {
    errors.push(jobNameError);
  }

  // Validate date
  if (typeof job.date !== 'undefined' && !(job.date instanceof Date)) {
    errors.push(new Error(`${prefix} had an invalid Date of ${job.date}`));
  }

  for (const prop of ['timeout', 'interval']) {
    if (typeof job[prop] !== 'undefined') {
      try {
        parseValue(job[prop]);
      } catch (err) {
        errors.push(
          combineErrors([
            new Error(`${prefix} had an invalid ${prop} of ${job.timeout}`),
            err
          ])
        );
      }
    }
  }

  // Validate hasSeconds
  if (
    typeof job.hasSeconds !== 'undefined' &&
    typeof job.hasSeconds !== 'boolean'
  ) {
    errors.push(
      new Error(
        `${prefix} had hasSeconds value of ${job.hasSeconds} (it must be a Boolean)`
      )
    );
  }

  // Validate cronValidate
  if (
    typeof job.cronValidate !== 'undefined' &&
    typeof job.cronValidate !== 'object'
  ) {
    errors.push(
      new Error(
        `${prefix} had cronValidate value set, but it must be an Object`
      )
    );
  }

  if (typeof job.cron !== 'undefined') {
    errors.push(...validateCron(job, prefix, config));
  }

  // Validate closeWorkerAfterMs
  if (
    typeof job.closeWorkerAfterMs !== 'undefined' &&
    (!Number.isFinite(job.closeWorkerAfterMs) || job.closeWorkerAfterMs <= 0)
  ) {
    errors.push(
      new Error(
        `${prefix} had an invalid closeWorkersAfterMs value of ${job.closeWorkersAfterMs} (it must be a finite number > 0)`
      )
    );
  }

  if (isSANB(job.timezone) && !['local', 'system'].includes(job.timezone)) {
    try {
      // `.toLocaleString()` will throw a `RangeError` if `timeZone` string
      // is bogus or not supported by the environment.
      new Date().toLocaleString('ia', { timeZone: job.timezone });
    } catch {
      errors.push(
        new Error(
          `${prefix} had an invalid or unsupported timezone specified: ${job.timezone}`
        )
      );
    }
  }

  if (errors.length > 0) {
    throw combineErrors(errors);
  }
};

module.exports = validate;
module.exports.cronValidateWithSeconds = cronValidateWithSeconds;
module.exports.validateCron = validateCron;
