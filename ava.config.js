module.exports = {
  files: ['test/*.js', 'test/**/*.js', '!test/jobs', '!test/noIndexJobs'],
  verbose: true,
  require: ['events.once/polyfill']
};
