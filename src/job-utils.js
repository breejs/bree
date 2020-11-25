const isSchedule = (value) => {
  return typeof value === 'object' && Array.isArray(value.schedules);
};

module.exports.isSchedule = isSchedule;
