import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const AMBIENT_CLOCK = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: 'Read time through platform/clock.ts so analysis stays deterministic and testable.',
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: 'Read time through platform/clock.ts so analysis stays deterministic and testable.',
  },
  {
    selector: "MemberExpression[object.name='performance'][property.name='now']",
    message: 'Read time through platform/clock.ts so analysis stays deterministic and testable.',
  },
];

const ENV_READ = {
  selector: "MemberExpression[object.type='MetaProperty'][property.name='env']",
  message: 'Read configuration through platform/config.ts, which parses it totally.',
};

export default defineConfig(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': 'error',
      'no-restricted-syntax': ['error', ...AMBIENT_CLOCK, ENV_READ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    // The analysis core is pure: numbers in, numbers out. It must not reach the
    // browser, the audio graph, the GPU or the platform adapters, so every
    // musical decision can be unit-tested with synthetic frames.
    files: ['src/analysis/**/*.ts'],
    ignores: ['src/analysis/**/*.test.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../audio/*', '../render/*', '../platform/*', '../main'],
              message: 'analysis/ is pure. Pass data in; do not import adapters.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'analysis/ must not touch the browser.' },
        { name: 'document', message: 'analysis/ must not touch the browser.' },
        { name: 'AudioContext', message: 'analysis/ must not touch Web Audio.' },
      ],
    },
  },
  {
    files: ['src/render/**/*.ts', 'src/audio/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../main'],
              message: 'Adapters must not depend on the composition root.',
            },
          ],
        },
      ],
    },
  },
  {
    // The single sanctioned homes for the raw console, clock and env.
    files: ['src/platform/logger.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['src/platform/clock.ts'],
    rules: { 'no-restricted-syntax': ['error', ENV_READ] },
  },
  {
    files: ['src/platform/config.ts'],
    rules: { 'no-restricted-syntax': ['error', ...AMBIENT_CLOCK] },
  },
  {
    files: ['**/*.test.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
);
