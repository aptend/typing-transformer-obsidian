import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/settings.ts'],
    },
    projects: [
      // 原有单元测试：全部走 mock alias
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
          exclude: ['test/unit/editor-logic.test.ts'],
        },
        resolve: {
          alias: {
            'obsidian': new URL('./test/mocks/obsidian.ts', import.meta.url).pathname,
            '@codemirror/state': new URL('./test/mocks/codemirror-state.ts', import.meta.url).pathname,
            '@codemirror/view': new URL('./test/mocks/codemirror-view.ts', import.meta.url).pathname,
          },
        },
      },
      // editor-logic 集成测试：用真实 @codemirror/state，只 mock obsidian
      {
        test: {
          name: 'editor-logic',
          include: ['test/unit/editor-logic.test.ts'],
        },
        resolve: {
          alias: {
            'obsidian': new URL('./test/mocks/obsidian.ts', import.meta.url).pathname,
          },
        },
      },
    ],
  },
});
