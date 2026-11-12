import { before, describe, it } from 'mocha';
import assert from 'node:assert/strict';
import { browser } from '@wdio/globals';
import 'wdio-obsidian-service';

const id = 'typing-transformer-obsidian';
const key = { ctrl: '\uE009', end: '\uE010', right: '\uE014', enter: '\uE007', backspace: '\uE003', release: '\uE000' };
let originalRules: string;
let noteNumber = 0;

async function ready() {
  await browser.waitUntil(() => browser.executeObsidian(({ app }, pluginId) =>
    Boolean((app as any).plugins.getPlugin(pluginId)?.rules?.sideInsertMap), id),
  { timeoutMsg: 'Built plugin failed to initialize (including WASM)' });
  await browser.executeObsidian(({ app }) => new Promise(resolve =>
    app.workspace.onLayoutReady(() => resolve(true))));
}

async function resetRules() {
  await browser.executeObsidian(async ({ app }, pluginId, rules) => {
    const plugin = (app as any).plugins.getPlugin(pluginId);
    plugin.settings.profiles = [{ title: 'Global', content: rules }];
    await plugin.configureProfile('Global', rules);
  }, id, originalRules);
}

async function openNote(live = false, initial = '') {
  const path = `Regression-${++noteNumber}.md`;
  await browser.executeObsidian(async ({ app, obsidian }, path, live, initial) => {
    await app.vault.create(path, initial);
    const leaf = app.workspace.getLeaf(false);
    await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: !live } });
    const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView)!;
    const cm = (view.editor as any).cm;
    cm.contentDOM.dataset.ttE2e = 'note';
    view.editor.setCursor({ line: 0, ch: 0 });
    cm.focus();
  }, path, live, initial);
  await browser.$('[data-tt-e2e="note"]').click();
  return path;
}

async function contents() {
  return browser.executeObsidian(({ app, obsidian }) => {
    const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView)!;
    const selection = (view.editor as any).cm.state.selection.main;
    return { text: view.editor.getValue(), anchor: selection.anchor, head: selection.head };
  });
}

async function expectText(text: string) {
  await browser.waitUntil(async () => (await contents()).text === text,
    { timeoutMsg: `Expected editor text ${JSON.stringify(text)}` });
}

async function chord(letter: string) {
  await browser.keys([key.ctrl, letter, key.release]);
}

async function type(text: string) {
  // Separate WebDriver commands generate actual input events; do not replace
  // this with editor.setValue(), dispatch(), or a clipboard paste.
  for (const char of text) await browser.keys(char);
}

describe('real Obsidian regression', () => {
  before(async () => {
    await ready();
    originalRules = await browser.executeObsidian(({ app }, pluginId) =>
      (app as any).plugins.getPlugin(pluginId).settings.profiles[0].content, id);
  });

  it('#124: cold start and restart never rewrite the opening code fence', async () => {
    async function check() {
      await browser.waitUntil(() => browser.executeObsidian(({ app, obsidian }) =>
        app.workspace.getActiveViewOfType(obsidian.MarkdownView)?.file?.path === 'Cold Start.md'));
      // Wait for rendering/normalisation, not an arbitrary sleep.
      await browser.execute(() => new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))));
      assert.equal((await contents()).text, '```shell\nfoo\n```\n');
      assert.equal(await browser.executeObsidian(async ({ app }) =>
        app.vault.adapter.read('Cold Start.md')), '```shell\nfoo\n```\n');
    }
    await check();
    await browser.reloadObsidian();
    await ready();
    await check();
  });

  for (const live of [false, true]) {
    it(`${live ? 'Live Preview' : 'Source'}: typing, undo and redo preserve content`, async () => {
      await resetRules();
      await openNote(live);
      await type('dpx');
      await expectText("don't panic");
      const states = ["don't panic"];
      // Keystrokes may group differently on a busy runner. Require reversible
      // progress within the finite user+plugin transaction count.
      for (let n = 0; n < 4; n++) {
        await chord('z');
        const text = (await contents()).text;
        assert.notEqual(text, states.at(-1), 'undo must make progress');
        states.push(text);
        if (text === '') break;
      }
      assert.equal(states[1], 'dpx', 'first undo must revert the conversion');
      assert.equal(states.at(-1), '', 'undo must return to the original document');
      for (const text of states.slice(0, -1).reverse()) {
        await chord('y');
        await expectText(text);
      }
      assert.equal((await contents()).head, "don't panic".length);
    });
  }

  it('pairing, pair deletion, selection cursor and WASM spacing use real input', async () => {
    await resetRules();
    await openNote();
    await type('《');
    await expectText('《》');
    assert.equal((await contents()).head, 1);
    await browser.keys(key.backspace);
    await expectText('');
    await type('hello');
    await chord('a');
    await type('q');
    await expectText('[hello]');
    assert.equal((await contents()).head, 6);
    await type('X');
    await expectText('[helloX]');
    await openNote();
    await type('中文English,');
    await expectText('中文 English,');
  });

  it('#125: separate Settings document renders and maps mouse/arrow input correctly', async () => {
    await resetRules();
    const main = await browser.getWindowHandle();
    const previous = await browser.getWindowHandles();
    await browser.executeObsidian(async ({ app }, pluginId) => {
      await (app as any).setting.open();
      (app as any).setting.openTabById(pluginId);
    }, id);
    await browser.waitUntil(() => browser.executeObsidian(({ app }, pluginId) => {
      const editor = (app as any).setting.pluginTabs.find((t: any) => t.id === pluginId)?.ruleEditor;
      return Boolean(editor?.dom.isConnected);
    }, id));
    const binding = await browser.executeObsidian(({ app }, pluginId) => {
      const editor = (app as any).setting.pluginTabs.find((t: any) => t.id === pluginId).ruleEditor;
      return { correctRoot: editor.root === editor.dom.getRootNode(), separateDocument: editor.dom.ownerDocument !== document };
    }, id);
    assert.equal(binding.correctRoot, true, 'CodeMirror must bind its actual document');
    assert.equal(binding.separateDocument, true, 'this regression must exercise a separate Settings window');
    await browser.waitUntil(async () => (await browser.getWindowHandles()).some(h => !previous.includes(h)));
    const settings = (await browser.getWindowHandles()).find(h => !previous.includes(h))!;
    try {
      await browser.switchToWindow(settings);
      const line = await browser.$('.rules-editor-wrapper .cm-line:nth-child(1)');
      await line.scrollIntoView();
      const position = await browser.execute(() => {
        const content = document.querySelector('.rules-editor-wrapper .cm-content')!;
        const line = content.querySelector('.cm-line')!;
        const node = document.createTreeWalker(line, NodeFilter.SHOW_TEXT).nextNode()!;
        const range = document.createRange();
        range.setStart(node, 3); range.collapse(true);
        const rect = range.getBoundingClientRect();
        const scroller = content.closest('.cm-scroller')!;
        return { x: Math.round(rect.left), y: Math.round(rect.top + rect.height / 2),
          height: rect.height, display: getComputedStyle(scroller).display };
      });
      assert.equal(position.display, 'flex', 'CodeMirror base layout CSS must exist in Settings');
      assert.ok(position.height > 0, 'rule text must occupy a visible line');
      await browser.performActions([{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions: [
        { type: 'pointerMove', duration: 0, x: position.x, y: position.y },
        { type: 'pointerDown', button: 0 }, { type: 'pointerUp', button: 0 },
      ] }]);
      await browser.keys(key.right);
      await type('a');
      await browser.closeWindow();
    } finally {
      await browser.switchToWindow(main);
    }
    await browser.waitUntil(() => browser.executeObsidian(({ app }, pluginId) =>
      (app as any).plugins.getPlugin(pluginId).settings.profiles[0].content.includes('# reagr'), id));
    const actual = await browser.executeObsidian(({ app }, pluginId) =>
      (app as any).plugins.getPlugin(pluginId).settings.profiles[0].content, id);
    assert.equal(actual, originalRules.slice(0, 4) + 'a' + originalRules.slice(4));
  });

  it('#123: saved Profile commands switch real rules and survive plugin reload', async () => {
    await resetRules();
    await openNote();
    await browser.executeObsidian(async ({ app }, pluginId) => {
      const plugin = (app as any).plugins.getPlugin(pluginId);
      plugin.settings.profiles.push({ title: 'CI Profile', content: "'zzq|' -> 'PROFILE_OK|'" });
      await plugin.saveSettings();
    }, id);
    const command = `${id}:typing-trans-p1`;
    assert.equal(await browser.executeObsidian(({ app }, command) =>
      (app as any).commands.commands[command]?.name, command), "Typing Transformer: Apply 'CI Profile' Profile");
    await browser.executeObsidianCommand(command);
    await browser.waitUntil(() => browser.executeObsidian(({ app }, pluginId) =>
      (app as any).plugins.getPlugin(pluginId).settings.activeProfile === 'CI Profile', id));
    await type('zzq');
    await expectText('PROFILE_OK');
    const page = browser.getObsidianPage();
    await page.disablePlugin(id);
    await page.enablePlugin(id);
    await ready();
    assert.equal(await browser.executeObsidian(({ app }, pluginId) =>
      (app as any).plugins.getPlugin(pluginId).settings.activeProfile, id), 'CI Profile');
    await browser.executeObsidianCommand(`${id}:typing-trans-p0`);
    await browser.waitUntil(() => browser.executeObsidian(({ app }, pluginId) =>
      (app as any).plugins.getPlugin(pluginId).settings.activeProfile === 'Global', id));
    await openNote();
    await type('zzq');
    await expectText('zzq');
  });
});
