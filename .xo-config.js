module.exports = {
  prettier: true,
  space: true,
  extends: ['xo-lass'],
  ignore: ['config.js'],
  rules: {
    'capitalized-comments': 'off',
    'unicorn/catch-error-name': 'off',
    'unicorn/require-post-message-target-origin': 'off'
  },
  overrides: [
    {
      files: 'test/jobs/*.js',
      rules: {
        'unicorn/no-process-exit': 'off'
      }
    },
    {
      files: ['*.ts', '**/*.ts'],
      parserOptions: {
        project: 'types/tsconfig.json'
      },
      rules: {
        'no-redeclare': 'warn',
        'no-unused-vars': 'warn',
        '@typescript-eslint/no-unsafe-assignment': 'warn',
        '@typescript-eslint/no-unsafe-call': 'warn',
        '@typescript-eslint/no-unused-vars': 'warn',
        '@typescript-eslint/no-empty-function': 'warn'
      }
    }
  ],
  parser: '@typescript-eslint/parser'
};
