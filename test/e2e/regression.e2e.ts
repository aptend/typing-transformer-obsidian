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

async function resetRules(extra = '', profiles: { title: string; content: string }[] = []) {
  await browser.executeObsidian(async ({ app }, pluginId, rules, profiles) => {
    const plugin = (app as any).plugins.getPlugin(pluginId);
    plugin.settings.profiles = [{ title: 'Global', content: rules }, ...profiles];
    await plugin.configureProfile('Global', rules);
    // Fixture reset: the existing Settings tab keeps its own editing model.
    const tab = (app as any).setting.pluginTabs.find((t: any) => t.id === pluginId);
    tab.editorState.profilesMap = new Map(plugin.settings.profiles.map((p: any) => [p.title, p.content]));
    tab.editorState.editedProfile.clear();
    tab.editorState.selectedProfileName = 'Global';
  }, id, originalRules + extra, profiles);
}

async function openNote(live = false, initial = '') {
  const path = `Regression-${++noteNumber}.md`;
  const livePreview = await browser.executeObsidian(async ({ app, obsidian }, path, live, initial) => {
    await app.vault.create(path, initial);
    const leaf = app.workspace.getLeaf(false);
    await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: !live } });
    const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView)!;
    const cm = (view.editor as any).cm;
    cm.contentDOM.dataset.ttE2e = 'note';
    view.editor.setCursor({ line: 0, ch: 0 });
    cm.focus();
    return cm.dom.closest('.markdown-source-view').classList.contains('is-live-preview');
  }, path, live, initial);
  assert.equal(livePreview, live, 'the test must exercise the requested editor mode');
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

async function openSettings() {
  const main = await browser.getWindowHandle();
  const previous = await browser.getWindowHandles();
  await browser.executeObsidian(async ({ app }, pluginId) => {
    await (app as any).setting.open();
    (app as any).setting.openTabById(pluginId);
  }, id);
  await browser.waitUntil(async () => (await browser.getWindowHandles()).some(h => !previous.includes(h)));
  const settings = (await browser.getWindowHandles()).find(h => !previous.includes(h))!;
  await browser.switchToWindow(settings);
  await browser.$('.rules-editor-wrapper .cm-content').waitForDisplayed();
  return { main, settings };
}

async function closeSettings(windows: { main: string; settings: string }) {
  if ((await browser.getWindowHandles()).includes(windows.settings)) {
    await browser.switchToWindow(windows.settings);
    await browser.closeWindow();
  }
  await browser.switchToWindow(windows.main);
}

async function expectSavedGlobal() {
  await browser.waitUntil(() => browser.executeObsidian(async ({ app }, pluginId, rules) => {
    const plugin = (app as any).plugins.getPlugin(pluginId);
    const saved = await plugin.loadData();
    return saved.profiles[0].content === rules && plugin.settings.profiles[0].content === rules;
  }, id, originalRules), { timeoutMsg: 'An invalid Settings draft replaced the saved Global rules' });
}

async function invalidateSettings() {
  await browser.$('.rules-editor-wrapper .cm-content').click();
  await chord('a');
  await type("'");
  await browser.$('.rules-editor-validity-indicator.invalid').waitForExist();
  assert.ok((await browser.$('.rules-editor-validity-text').getText()).length > 0);
}

async function roundTrip(initial: string, final: string) {
  const states = [final];
  for (let n = 0; n < 24; n++) {
    await chord('z');
    const text = (await contents()).text;
    assert.notEqual(text, states.at(-1), 'undo must progress, including after a no-op formatting pass');
    states.push(text);
    if (text === initial) break;
  }
  assert.equal(states.at(-1), initial, 'undo must reach the original document without looping');
  for (const text of states.slice(0, -1).reverse()) {
    await chord('y');
    await expectText(text);
  }
  return states;
}

async function backgroundMetadata(code: boolean) {
  const path = `Metadata-${++noteNumber}.md`;
  await browser.executeObsidian(async ({ app }, path, code) => {
    await app.vault.create(path, code ? '```text\nnoise\n```\n' : 'plain metadata noise');
  }, path, code);
  await browser.waitUntil(() => browser.executeObsidian(({ app, obsidian }, path) => {
    const file = app.vault.getAbstractFileByPath(path);
    return file instanceof obsidian.TFile && Boolean(app.metadataCache.getFileCache(file)?.sections?.length);
  }, path), { timeoutMsg: 'Background note metadata was not indexed' });
}

async function focusNote(path: string, live: boolean, line: number, ch: number) {
  await browser.executeObsidian(async ({ app, obsidian }, path, live, line, ch) => {
    await app.workspace.getLeaf(false).setViewState({
      type: 'markdown', state: { file: path, mode: 'source', source: !live },
    });
    const editor = app.workspace.getActiveViewOfType(obsidian.MarkdownView)!.editor;
    editor.setCursor({ line, ch });
    editor.focus();
  }, path, live, line, ch);
}

async function installDelayedClipboard() {
  await browser.execute(() => {
    const control = { reads: 0, resolve: undefined as ((text: string) => void) | undefined,
      errors: [] as string[], descriptor: Object.getOwnPropertyDescriptor(navigator.clipboard, 'readText') };
    const handler = (event: PromiseRejectionEvent) => control.errors.push(String(event.reason));
    Object.assign(control, { handler });
    (window as any).__ttClipboard = control;
    window.addEventListener('unhandledrejection', handler);
    Object.defineProperty(navigator.clipboard, 'readText', { configurable: true, value: () => {
      control.reads++;
      return new Promise<string>(resolve => { control.resolve = resolve; });
    } });
  });
}

async function releaseClipboard() {
  await browser.execute(async () => {
    (window as any).__ttClipboard.resolve?.('CLIPBOARD');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function restoreClipboard() {
  return browser.execute(() => {
    const control = (window as any).__ttClipboard;
    window.removeEventListener('unhandledrejection', control.handler);
    if (control.descriptor) Object.defineProperty(navigator.clipboard, 'readText', control.descriptor);
    else delete (navigator.clipboard as any).readText;
    delete (window as any).__ttClipboard;
    return control.errors as string[];
  });
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

  it('invalid Settings drafts never replace persisted or active rules when the window closes', async () => {
    await resetRules();
    await openNote();
    const windows = await openSettings();
    try {
      await invalidateSettings();
    } finally {
      await closeSettings(windows);
    }
    await expectSavedGlobal();
    await type('dpx');
    await expectText("don't panic");
    const reopened = await openSettings();
    try {
      assert.equal(await browser.$('.rules-editor-wrapper .cm-content').getText(), originalRules.trimEnd());
      assert.equal(await browser.$('.rules-editor-validity-indicator.invalid').isExisting(), false);
    } finally {
      await closeSettings(reopened);
    }
    await expectSavedGlobal();
  });

  it('invalid Settings drafts require discard confirmation before switching Profile', async () => {
    const profileRules = "'zzq|' -> 'PROFILE_OK|'";
    await resetRules('', [{ title: 'Draft CI', content: profileRules }]);
    await openNote();
    const windows = await openSettings();
    async function respond(answer: 'Confirm' | 'Cancel') {
      // Obsidian may attach the confirmation modal to either desktop window.
      let modalWindow: string | undefined;
      await browser.waitUntil(async () => {
        for (const handle of [windows.settings, windows.main]) {
          await browser.switchToWindow(handle);
          if (await browser.$(`.modal button=${answer}`).isExisting()) { modalWindow = handle; return true; }
        }
        return false;
      }, { timeoutMsg: 'Discard confirmation was not shown' });
      await browser.switchToWindow(modalWindow!);
      await browser.$(`.modal button=${answer}`).click();
      await browser.switchToWindow(windows.settings);
    }
    try {
      await invalidateSettings();
      await browser.$('.rules-profile-button[accesskey="Draft CI"]').click();
      await respond('Cancel');
      assert.equal(await browser.$('.rules-profile-button.selected').getAttribute('accesskey'), 'Global');
      assert.equal(await browser.$('.rules-editor-wrapper .cm-content').getText(), "'");
      await browser.$('.rules-profile-button[accesskey="Draft CI"]').click();
      await respond('Confirm');
      await browser.waitUntil(async () =>
        (await browser.$('.rules-profile-button.selected').getAttribute('accesskey')) === 'Draft CI');
      assert.equal(await browser.$('.rules-editor-wrapper .cm-content').getText(), profileRules);
      assert.equal(await browser.$('.rules-editor-validity-indicator.invalid').isExisting(), false);
    } finally {
      await closeSettings(windows);
    }
    await expectSavedGlobal();
    await browser.waitUntil(() => browser.executeObsidian(({ app }, pluginId) =>
      (app as any).plugins.getPlugin(pluginId).settings.activeProfile === 'Draft CI', id));
    await type('dpx');
    await expectText("don't panic");
    await openNote();
    await type('zzq');
    await expectText('PROFILE_OK');
  });

  it('#109: changing the system clipboard after startup changes the next expansion', async () => {
    await resetRules("\n'cbx|' -f '$CLIPBOARD'");
    for (const text of ['first 中文😀', 'second 𐙟 value']) {
      await openNote();
      await browser.execute(async text => navigator.clipboard.writeText(text), text);
      assert.equal(await browser.execute(() => navigator.clipboard.readText()), text);
      await type('cbx');
      await expectText(text);
      assert.equal((await contents()).head, text.length);
    }
  });

  for (const live of [false, true]) {
    it(`#74 ${live ? 'Live Preview' : 'Source'}: automatic spacing supports full undo/redo and redo invalidation`, async () => {
      await resetRules();
      await openNote(live);
      const raw = '中文English,';
      const formatted = '中文 English,';
      await type(raw);
      await expectText(formatted);
      const states = await roundTrip('', formatted);
      assert.equal(states[1], raw, 'first undo must reverse automatic spacing');
      await chord('z');
      await expectText(raw);
      await type('X');
      await expectText(raw + 'X');
      await chord('y');
      await expectText(raw + 'X');
      // Formatting this ASCII input makes no change. It must not create an
      // empty history event that traps repeated undo/redo (#74).
      await openNote(live);
      await type('hello world,');
      await expectText('hello world,');
      await roundTrip('', 'hello world,');
    });

    it(`${live ? 'Live Preview' : 'Source'}: unrelated note metadata cannot change code-block protection`, async () => {
      await resetRules();
      const plain = await openNote(live);
      await backgroundMetadata(true);
      await type('中文English,');
      await expectText('中文 English,');
      const code = await openNote(live, '```text\n\n```\n');
      await focusNote(code, live, 1, 0);
      await backgroundMetadata(false);
      await type('中文English,');
      const codeText = '```text\n中文English,\n```\n';
      await expectText(codeText);
      await focusNote(plain, live, 0, '中文 English,'.length);
      await browser.keys(key.enter);
      await backgroundMetadata(true);
      await type('中文English,');
      const plainText = '中文 English,\n中文 English,';
      await expectText(plainText);
      await browser.waitUntil(() => browser.executeObsidian(async ({ app }, code, codeText, plain, plainText) =>
        await app.vault.adapter.read(code) === codeText && await app.vault.adapter.read(plain) === plainText,
      code, codeText, plain, plainText), { timeoutMsg: 'Editor contents were not saved correctly to their respective notes' });
    });
  }

  for (const interference of ['typing', 'selection', 'switching notes'] as const) {
    it(`delayed clipboard conversion cannot overwrite newer state after ${interference}`, async () => {
      await resetRules("\n'cbx|' -f '$CLIPBOARD'");
      const original = await openNote();
      await installDelayedClipboard();
      let errors: string[] = [];
      try {
        await type('cbx');
        await browser.waitUntil(() => browser.execute(() => (window as any).__ttClipboard.reads === 1));
        if (interference === 'typing') await type('TAIL');
        if (interference === 'selection') await browser.keys('\uE012'); // ArrowLeft
        if (interference === 'switching notes') { await openNote(); await type('safe'); }
        await releaseClipboard();
        if (interference === 'typing') await expectText('cbxTAIL');
        if (interference === 'selection') {
          await expectText('cbx');
          assert.equal((await contents()).head, 2, 'late conversion must not reset the moved cursor');
          await type('X');
          await expectText('cbXx');
        }
        if (interference === 'switching notes') {
          await expectText('safe');
          await focusNote(original, false, 0, 3);
          await expectText('cbx');
        }
      } finally {
        await releaseClipboard();
        errors = await restoreClipboard();
      }
      assert.deepEqual(errors, [], 'asynchronous conversion must not reject or dispatch invalid positions');
    });
  }

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
