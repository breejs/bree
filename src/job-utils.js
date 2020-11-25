const isSANB = require('is-string-and-not-blank');

const isSchedule = (value) => {
  return typeof value === 'object' && Array.isArray(value.schedules);
};

const getName = (job) => {
  if (isSANB(job)) return job;
  if (typeof job === 'object' && isSANB(job.name)) return job.name;
  if (typeof job === 'function' && isSANB(job.name)) return job.name;
};

module.exports.isSchedule = isSchedule;
module.exports.getName = getName;
