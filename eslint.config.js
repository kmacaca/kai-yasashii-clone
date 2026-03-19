import js from '@eslint/js'
import importPlugin from 'eslint-plugin-import'
import globals from 'globals'

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: { import: importPlugin },
    rules: {
      'arrow-body-style': ['warn', 'as-needed'],
      curly: ['error', 'all'],
      eqeqeq: 'error',
      'eol-last': ['error', 'always'],
      'no-console': 'warn',
      'no-duplicate-imports': 'error',
      'no-else-return': 'warn',
      'no-floating-decimal': 'error',
      'no-unused-vars': 'warn',
      'no-var': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-const': 'error',
      'object-shorthand': 'error',
      'import/order': [
        'error',
        {
          alphabetize: { order: 'asc' },
        },
      ],
      'import/first': 'error',
    },
  },
]
