import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const restrict = (...patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

const noUpwardLayers = {
  group: ['@/app', '@/app/*', '@/features', '@/features/*'],
  message: 'Shared layers must not depend on app or features.',
};

export default defineConfig([
  globalIgnores([
    'dist',
    'coverage',
    'playwright-report',
    'test-results',
    'pipeline',
    'public/data',
    'worker/worker-configuration.d.ts',
  ]),

  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite()],
    languageOptions: { globals: globals.browser },
  },

  // Named exports only; config files and the Worker entry are the exceptions.
  {
    files: ['src/**/*.{ts,tsx}', 'worker/**/*.ts'],
    ignores: ['worker/index.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'ExportDefaultDeclaration', message: 'Use named exports.' },
      ],
    },
  },

  // Layer boundaries (see memory-bank/systemPatterns.md).
  {
    files: ['src/engine/**/*.ts'],
    rules: restrict({
      group: [
        'react',
        'react-dom',
        'react/*',
        'maplibre-gl',
        '@deck.gl/*',
        'zustand',
        'zustand/*',
        'i18next',
        'react-i18next',
        '@/*',
        '!@/lib/math',
        '!@/lib/math/*',
        '!@/types',
        '!@/types/*',
      ],
      message: 'The engine is pure TypeScript: only @/lib/math and @/types are allowed.',
    }),
  },
  {
    files: ['src/workers/**/*.ts'],
    rules: restrict({
      group: [
        'react',
        'react-dom',
        'react/*',
        '@/app',
        '@/app/*',
        '@/features',
        '@/features/*',
        '@/components/*',
        '@/state/*',
      ],
      message: 'Workers wrap the engine and must not depend on UI layers.',
    }),
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: restrict(
      { group: ['@/features/*/*'], message: 'Import another feature only through its index.ts.' },
      { group: ['@/app', '@/app/*'], message: 'Features must not depend on the app shell.' },
      { group: ['@/engine', '@/engine/*'], message: 'Features reach the engine through workers.' },
    ),
  },
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: restrict(
      { group: ['@/features/*/*'], message: 'Import features only through their index.ts.' },
      {
        group: ['@/engine', '@/engine/*'],
        message: 'The app shell reaches the engine through workers.',
      },
    ),
  },
  {
    files: [
      'src/components/**/*.{ts,tsx}',
      'src/lib/**/*.ts',
      'src/state/**/*.ts',
      'src/data/**/*.ts',
      'src/i18n/**/*.ts',
      'src/types/**/*.ts',
    ],
    rules: restrict(noUpwardLayers),
  },

  {
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
]);
