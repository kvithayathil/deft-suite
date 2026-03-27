import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import securityPlugin from 'eslint-plugin-security';
import sonarjsPlugin from 'eslint-plugin-sonarjs';

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setImmediate: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        AbortController: 'readonly',
        URL: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      security: securityPlugin,
      sonarjs: sonarjsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...securityPlugin.configs.recommended.rules,
      ...sonarjsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      'no-undef': 'off',
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-unsafe-regex': 'off',
      'sonarjs/cognitive-complexity': ['warn', 15],
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/void-use': 'off',
      'sonarjs/no-os-command-from-path': 'off',
      'sonarjs/hashing': 'off',
      'sonarjs/no-nested-template-literals': 'off',
      'sonarjs/todo-tag': 'off',
      'sonarjs/slow-regex': 'warn',
      'sonarjs/no-duplicated-branches': 'warn',
    },
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'sonarjs/publicly-writable-directories': 'off',
      'sonarjs/unused-import': 'off',
      'sonarjs/no-dead-store': 'off',
      'sonarjs/no-unused-vars': 'off',
      'sonarjs/assertions-in-tests': 'warn',
    },
  },
];
