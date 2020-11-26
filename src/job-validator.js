const fs = require('fs');
const { join } = require('path');
const combineErrors = require('combine-errors');
const cron = require('cron-validate');
const isSANB = require('is-string-and-not-blank');
const isValidPath = require('is-valid-path');
const threads = require('bthreads');

const { getName, isSchedule, parseValue } = require('./job-utils');

const validateReservedJobName = (name) => {
  // don't allow a job to have the `index` file name
  if (['index', 'index.js', 'index.mjs'].includes(name))
    return new Error(
      'You cannot use the reserved job name of "index", "index.js", nor "index.mjs"'
    );
};

const validateStringJob = (job, i, config) => {
  const errors = [];

  const jobNameError = validateReservedJobName(job);
  if (jobNameError) throw jobNameError;

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
    job.endsWith('.js') || job.endsWith('.mjs')
      ? job
      : `${job}.${config.defaultExtension}`
  );

  /* istanbul ignore next */
  if (!threads.browser) {
    const stats = fs.statSync(path);
    if (!stats.isFile())
      throw new Error(`Job #${i + 1} "${job}" path missing: ${path}`);
  }
};

const validateFunctionJob = (job, i) => {
  const errors = [];

  const path = `(${job.toString()})()`;
  // can't be a built-in or bound function
  if (path.includes('[native code]'))
    errors.push(
      new Error(`Job #${i + 1} can't be a bound or built-in function`)
    );

  if (errors.length > 0) throw combineErrors(errors);
};

const validateJobPath = (job, prefix, config) => {
  const errors = [];

  if (typeof job.path === 'function') {
    const path = `(${job.path.toString()})()`;

    // can't be a built-in or bound function
    if (path.includes('[native code]'))
      errors.push(new Error(`${prefix} can't be a bound or built-in function`));
  } else if (!isSANB(job.path) && !config.root) {
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
          config.root,
          job.name.endsWith('.js') || job.name.endsWith('.mjs')
            ? job.name
            : `${job.name}.${config.defaultExtension}`
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
      } catch (err) {
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
    //
    // validate cron pattern
    // (must support patterns such as `* * L * *` and `0 0/5 14 * * ?` (and aliases too)
    //
    //  <https://github.com/Airfooox/cron-validate/issues/67>
    //
    const result = cron(
      job.cron,
      typeof job.cronValidate === 'undefined'
        ? config.cronValidate
        : job.cronValidate
    );

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

  if (!name) errors.push(new Error(`Job #${i + 1} is missing a name`));

  // throw an error if duplicate job names
  if (reservedNames.includes(name)) {
    errors.push(
      new Error(`Job #${i + 1} has a duplicate job name of ${getName(job)}`)
    );
  }

  return errors;
};

// eslint-disable-next-line complexity
const validate = (job, i, names = [], config = {}) => {
  const errors = validateJobName(job, i, names);

  if (errors.length > 0) throw combineErrors(errors);

  // support a simple string which we will transform to have a path
  if (isSANB(job)) {
    return validateStringJob(job, i, config);
  }

  // job is a function
  if (typeof job === 'function') {
    return validateFunctionJob(job, i);
  }

  // use a prefix for errors
  const prefix = `Job #${i + 1} named "${job.name}"`;

  errors.push(...validateJobPath(job, prefix, config));

  // don't allow users to mix interval AND cron
  if (typeof job.interval !== 'undefined' && typeof job.cron !== 'undefined') {
    errors.push(
      new Error(`${prefix} cannot have both interval and cron configuration`)
    );
  }

  // don't allow users to mix timeout AND date
  if (typeof job.timeout !== 'undefined' && typeof job.date !== 'undefined')
    errors.push(new Error(`${prefix} cannot have both timeout and date`));

  const jobNameError = validateReservedJobName(job.name);
  if (jobNameError) errors.push(jobNameError);

  // validate date
  if (typeof job.date !== 'undefined' && !(job.date instanceof Date))
    errors.push(new Error(`${prefix} had an invalid Date of ${job.date}`));

  // validate timeout
  if (typeof job.timeout !== 'undefined') {
    try {
      parseValue(job.timeout);
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
      parseValue(job.interval);
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
    job.cronValidate = cronValidateWithSeconds(job, config);
  }

  // validate cron
  if (typeof job.cron !== 'undefined') {
    errors.push(...validateCron(job, prefix, config));
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
};

module.exports = validate;
