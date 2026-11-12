import { mkdir, writeFile } from 'node:fs/promises';
import { browser } from '@wdio/globals';
import 'wdio-obsidian-service';

export const config: WebdriverIO.Config = {
  runner: 'local', framework: 'mocha',
  specs: ['./test/e2e/**/*.e2e.ts'],
  maxInstances: 1,
  capabilities: [{
    browserName: 'obsidian',
    'wdio:obsidianOptions': {
      appVersion: '1.14.4', installerVersion: '1.9.14',
      vault: './artifacts/e2e-vault',
      plugins: ['./artifacts/e2e-vault/.obsidian/plugins/typing-transformer-obsidian'],
      copy: true,
    },
  }],
  services: ['obsidian'], reporters: ['obsidian'],
  cacheDir: '.obsidian-cache', outputDir: 'artifacts/e2e/logs',
  mochaOpts: { ui: 'bdd', timeout: 60000 },
  waitforTimeout: 15000, logLevel: 'warn', injectGlobals: false,
  async afterTest(test, _context, { passed }) {
    if (passed) return;
    await mkdir('artifacts/e2e', { recursive: true });
    const name = test.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 100);
    try {
      await browser.saveScreenshot(`artifacts/e2e/${name}.png`);
      const state = await browser.executeObsidian(({ app, obsidian }) => {
        const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
        return { file: view?.file?.path, text: view?.editor.getValue(), cursor: view?.editor.getCursor() };
      });
      await writeFile(`artifacts/e2e/${name}.json`, JSON.stringify(state, null, 2));
    } catch (error) {
      await writeFile(`artifacts/e2e/${name}-capture-error.txt`, String(error));
    }
  },
};
