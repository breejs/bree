module.exports = {
  prettier: true,
  space: true,
  extends: ['xo-lass'],
  ignore: ['config.js'],
  rules: {
    'capitalized-comments': 'off',
    'unicorn/catch-error-name': 'off',
    'unicorn/require-post-message-target-origin': 'off',
    'unicorn/prefer-node-protocol': 'warn',
    'unicorn/prefer-top-level-await': 'warn',
    'unicorn/prefer-event-target': 'off',
    'unicorn/no-empty-file': 'warn',
    'unicorn/no-process-exit': 'warn',
    'unicorn/prefer-logical-operator-over-ternary': 'warn'
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
        '@typescript-eslint/no-empty-function': 'warn',
        '@typescript-eslint/consistent-type-definitions': 'off',
        '@typescript-eslint/consistent-type-imports': 'off'
      }
    }
  ],
  parser: '@typescript-eslint/parser'
};
