const ms = require('ms');
const humanInterval = require('human-interval');
const later = require('@breejs/later');
const isSANB = require('is-string-and-not-blank');

const isSchedule = (value) => {
  return typeof value === 'object' && Array.isArray(value.schedules);
};

const getName = (job) => {
  if (isSANB(job)) return job;
  if (typeof job === 'object' && isSANB(job.name)) return job.name;
  if (typeof job === 'function' && isSANB(job.name)) return job.name;
};

const getHumanToMs = (_value) => {
  const value = humanInterval(_value);
  if (Number.isNaN(value)) return ms(_value);
  return value;
};

const parseValue = (value) => {
  if (value === false) return value;

  if (this.isSchedule(value)) return value;

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

module.exports.isSchedule = isSchedule;
module.exports.getName = getName;
module.exports.getHumanToMs = getHumanToMs;
module.exports.parseValue = parseValue;
