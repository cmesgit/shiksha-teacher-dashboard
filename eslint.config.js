import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    // eslint-plugin-react is present only for jsx-uses-vars: core no-unused-vars
    // does not count a JSX element reference (<Icon />) as using the binding, so
    // components destructured from a list (.map(({ Icon }) => <Icon />)) were
    // reported as unused. Those are parameters, so varsIgnorePattern below never
    // applied to them. The rest of the plugin's rules stay off.
    plugins: { react },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'react/jsx-uses-vars': 'error',
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // vite.config.js / eslint.config.js are executed by Node, not the browser,
    // so `__dirname` and friends are defined there.
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
])