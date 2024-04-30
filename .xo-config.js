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
      files: '**/*.mjs',
      parserOptions: {
        sourceType: 'module'
      }
    },
    {
      files: 'test/jobs/*.js',
      rules: {
        'unicorn/no-process-exit': 'off'
      }
    },
    {
      files: ['**/*.d.ts'],
      rules: {
        'no-unused-vars': 'off',
        '@typescript-eslint/naming-convention': 'off',
        'no-redeclare': 'off',
        '@typescript-eslint/no-redeclare': 'off'
      }
    },
    {
      files: ['**/*.test-d.ts'],
      rules: {
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-confusing-void-expression': 'off', // Conflicts with `expectError` assertion.
        '@typescript-eslint/no-unsafe-assignment': 'off'
      }
    }
  ]
};
