import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/settings.ts']
    }
  },
  resolve: {
    alias: {
      'obsidian': new URL('./test/mocks/obsidian.ts', import.meta.url).pathname,
      '@codemirror/state': new URL('./test/mocks/codemirror-state.ts', import.meta.url).pathname,
      '@codemirror/view': new URL('./test/mocks/codemirror-view.ts', import.meta.url).pathname,
    }
  }
});
