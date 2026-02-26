import js from '@eslint/js';
import globals from 'globals';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import react from 'eslint-plugin-react';

export default [
  {
    ignores: ['node_modules/**', '**/dist/**', '**/build/**', 'BugTraceAI-WEB-DEV2/**', '.trash/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react': react,
      'react-hooks': reactHooks
    },
    rules: {
      // React hooks - CRITICAL for pattern enforcement
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Component size - warn at 200 lines
      'max-lines': ['warn', { max: 200, skipBlankLines: true, skipComments: true }],

      // TypeScript rules
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // React rules
      'react/prop-types': 'off', // Using TypeScript instead
      'react/react-in-jsx-scope': 'off', // React 17+ JSX transform

      // General rules
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'off', // Using @typescript-eslint version instead
      'no-undef': 'off', // TypeScript compiler handles undefined variable checking
    },
    settings: {
      react: { version: 'detect' }
    }
  }
];
