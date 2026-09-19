import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    singleQuote: true,
    ignorePatterns: ['docs/**', '.pi/**', '.agents/**', 'AGENTS.md', 'skills-lock.json'],
  },
  lint: {
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
  staged: {
    '*.{ts,css,html,json}': 'vp check --fix',
  },
  base: '/thronefall-zombies/',
});
