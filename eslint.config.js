import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    // Archivos del navegador (src/**, excepto test): React + hooks
    files: ['src/**/*.{js,jsx}', '!src/**/*.test.js'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Tests unitarios (vitest): entorno browser + globals de vitest
    files: ['src/**/*.test.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, vitest: true },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Scripts de test Node (test/**) y archivos de config (vite/vitest):
    // no son React, corren en Node → globals.node + esm globals
    files: ['test/**/*.js', 'vite.config.js', 'vitest.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      // En scripts Node, process y __dirname son legítimos
      'no-undef': 'off',
    },
  },
])
