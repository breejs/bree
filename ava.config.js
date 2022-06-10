module.exports = {
  files: [
    'test/*.js',
    'test/**/*.js',
    '!test/jobs',
    '!test/noIndexJobs',
    '!test/issues/**/jobs',
    '!test/issues/**/jobs-no-default-export'
  ],
  verbose: true,
  require: ['events.once/polyfill']
};
