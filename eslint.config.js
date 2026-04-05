import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,

  // Client code — browser globals
  {
    files: ['client/src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': 'warn',
    },
  },

  // Server code — Node.js globals
  {
    files: ['server/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      eqeqeq: ['error', 'always'],
    },
  },

  // Ignore build output and dependencies
  {
    ignores: ['client/dist/**', 'node_modules/**', 'server/node_modules/**', 'client/node_modules/**'],
  },
];
