const ms = require('ms');
const humanInterval = require('human-interval');
const later = require('@breejs/later');
const isSANB = require('is-string-and-not-blank');

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
  if (value === false) return value;

  if (isSchedule(value)) return value;

  if (isSANB(value)) {
    const schedule = later.schedule(later.parse.text(value));
    if (schedule.isValid()) return later.parse.text(value);
    value = getHumanToMs(value);
  }

  if (!Number.isFinite(value) || value < 0)
    throw new Error(
      `Value ${value} must be a finite number >= 0 or a String parseable by \`later.parse.text\` (see <https://breejs.github.io/later/parsers.html#text> for examples)`
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

module.exports.isSchedule = isSchedule;
module.exports.getName = getName;
module.exports.getHumanToMs = getHumanToMs;
module.exports.parseValue = parseValue;
module.exports.getJobNames = getJobNames;
