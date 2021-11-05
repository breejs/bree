const humanInterval = require('human-interval');
const isSANB = require('is-string-and-not-blank');
const later = require('@breejs/later');
const ms = require('ms');

/**
 * Naively checks if passed value is of later.js schedule format (https://breejs.github.io/later/schedules.html)
 *
 * @param {*} value to check for schedule format
 * @returns {boolean}
 */
const isSchedule = (value) => {
  return typeof value === 'object' && Array.isArray(value.schedules);
};

/**
 * Extracts job name from job definition
 *
 * @param {string | Object | Function} job definition
 * @returns {string}
 */
const getName = (job) => {
  if (isSANB(job)) return job;
  if (typeof job === 'object' && isSANB(job.name)) return job.name;
  if (typeof job === 'function' && isSANB(job.name)) return job.name;
};

/**
 * Parses provided value into millisecond
 *
 * @param {string} _value
 */
const getHumanToMs = (_value) => {
  const value = humanInterval(_value);
  if (Number.isNaN(value)) return ms(_value);
  return value;
};

/**
 * Parses schedule value into "later" schedule object or milliseconds
 *
 * @param {boolean | string | number | Object} value
 * @returns {number | boolean | Object}
 */
const parseValue = (value) => {
  const originalValue = value;

  if (value === false) return value;

  if (isSchedule(value)) return value;

  if (isSANB(value)) {
    const schedule = later.schedule(later.parse.text(value));
    if (schedule.isValid()) return later.parse.text(value);
    value = getHumanToMs(value);
    if (value === 0) {
      // There is a bug in the human-interval library that causes some invalid
      // strings to be parsed as valid, returning 0 as output (instead of NaN).
      // Since the user is using a String to define the interval, it is most
      // likely that he/she is not trying to set it to 0ms.
      // Hence, this must be an error.
      throw new Error(
        `Value "${originalValue}" is not a String parseable by \`later.parse.text\` (see <https://breejs.github.io/later/parsers.html#text> for examples)`
      );
    }
  }

  if (!Number.isFinite(value) || value < 0)
    throw new Error(
      `Value "${originalValue}" must be a finite number >= 0 or a String parseable by \`later.parse.text\` (see <https://breejs.github.io/later/parsers.html#text> for examples)`
    );

  return value;
};

/**
 * Processes job objects extracting their names
 * Can conditionaly skip records by their index
 *
 * @param {any[]} jobs
 * @param {number} excludeIndex
 * @returns {string[]} job names
 */
const getJobNames = (jobs, excludeIndex) => {
  const names = [];

  for (const [i, job] of jobs.entries()) {
    if (i === excludeIndex) continue;

    const name = getName(job);

    if (name) names.push(name);
  }

  return names;
};

module.exports = {
  getHumanToMs,
  getJobNames,
  getName,
  isSchedule,
  parseValue
};
