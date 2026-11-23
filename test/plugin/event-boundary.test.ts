import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChangeSet, EditorState } from '@codemirror/state';
import type { ViewUpdate } from '@codemirror/view';
import { editorInfoField } from 'obsidian';
import TypingTransformer from '../../src/main';
import { planLine } from '../../liberty-web/charliberty';

// Keep the production plugin and its actual filters. Only replace UI/platform
// dependencies; rules and CodeMirror transactions remain real.
vi.mock('../../src/settings', () => ({
  BaseProfileName: 'Global', DEFAULT_SETTINGS: {}, SettingTab: class {},
}));
vi.mock('../../liberty-web/charliberty_bg.wasm', () => ({ default: new Uint8Array() }));
vi.mock('../../liberty-web/charliberty', () => ({
  default: vi.fn(),
  planLine: vi.fn((_line: string, to: number) => ({ from: 0, to, takeEdits: () => new Uint32Array(), free: vi.fn() })),
}));

async function pluginWithRules(text: string) {
  const plugin = new TypingTransformer({} as never, {} as never);
  plugin.app = { vault: { adapter: { stat: vi.fn(), read: vi.fn() } } } as never;
  await plugin.configureRules(text);
  return plugin;
}

function replacement(userEvent?: string) {
  const startState = EditorState.create({ doc: '```shell\nfoo\n```' });
  const changes = ChangeSet.of({ from: 0, to: 3, insert: '`' }, startState.doc.length);
  const tr = startState.update({ changes, ...(userEvent ? { userEvent } : {}) });
  const dispatch = vi.fn();
  const update = {
    docChanged: true, startState, changes, transactions: [tr],
    view: { state: tr.state, dispatch },
  } as unknown as ViewUpdate;
  return { update, dispatch };
}

describe('production event boundary — issue #124', () => {
  it.each([undefined, 'undo', 'redo'])('ignores a structural/undo/redo update (%s)', async event => {
    const plugin = await pluginWithRules("'`' -> '`' + '`'");
    const { update, dispatch } = replacement(event);
    plugin.sidesInsertFilter(update);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('still wraps the identical replacement when it comes from user input', async () => {
    const plugin = await pluginWithRules("'`' -> '`' + '`'");
    const { update, dispatch } = replacement('input.type');
    plugin.sidesInsertFilter(update);
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls[0][0].changes.insert).toBe('`````');
  });

  it('does not recursively process its own generated transaction', async () => {
    const plugin = await pluginWithRules("'`' -> '`' + '`'");
    const { update, dispatch } = replacement('input.type');
    plugin.sidesInsertFilter(update);
    const tr = update.view.state.update(dispatch.mock.calls[0][0]);
    const nextDispatch = vi.fn();
    plugin.sidesInsertFilter({
      docChanged: true, startState: tr.startState, changes: tr.changes,
      transactions: [tr], view: { state: tr.state, dispatch: nextDispatch },
    } as unknown as ViewUpdate);
    expect(nextDispatch).not.toHaveBeenCalled();
  });
});

describe('asynchronous production conversion', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the clipboard again on every match without rebuilding the rules (#109)', async () => {
    const readText = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    vi.stubGlobal('navigator', { clipboard: { readText } });
    const plugin = await pluginWithRules("'x|' -f '$CLIPBOARD'");
    expect(readText).not.toHaveBeenCalled();
    expect((await plugin.rules.match('', 'x', 0)).replace).toBe('first');
    expect((await plugin.rules.match('', 'x', 0)).replace).toBe('second');
    expect(readText).toHaveBeenCalledTimes(2);
  });

  for (const interference of ['none', 'typing', 'selection', 'profile', 'detached'] as const) {
    it(`preserves newer editor state while clipboard resolution is pending: ${interference}`, async () => {
      let resolveRead: (text: string) => void;
      const readText = vi.fn(() => new Promise<string>(resolve => { resolveRead = resolve; }));
      vi.stubGlobal('navigator', { clipboard: { readText } });
      const plugin = await pluginWithRules("'x|' -f '$CLIPBOARD'");
      const startState = EditorState.create({ doc: '' });
      const tr = startState.update({ changes: { from: 0, insert: 'x' }, selection: { anchor: 1 }, userEvent: 'input.type' });
      const dispatch = vi.fn();
      const view = { state: tr.state, dispatch, dom: { isConnected: true } };
      const pending = plugin.convertFilter({
        docChanged: true, startState, changes: tr.changes, transactions: [tr], view,
      } as unknown as ViewUpdate);
      expect(readText).toHaveBeenCalledOnce();
      if (interference === 'typing') view.state = view.state.update({ changes: { from: 1, insert: 'safe' } }).state;
      if (interference === 'selection') view.state = view.state.update({ selection: { anchor: 0 } }).state;
      if (interference === 'profile') await plugin.configureRules("'x|' -> 'NEW|'");
      if (interference === 'detached') view.dom.isConnected = false;
      resolveRead!('CLIPBOARD');
      await pending;
      if (interference === 'none') {
        expect(dispatch).toHaveBeenCalledOnce();
        expect(dispatch.mock.calls[0][0].changes.insert).toBe('CLIPBOARD');
      } else {
        expect(dispatch).not.toHaveBeenCalled();
      }
    });
  }
});

describe('formatting zones belong to the editor file', () => {
  it.each([false, true])('uses the current file cache despite unrelated metadata updates (code=%s)', async code => {
    const plugin = await pluginWithRules("'a|' -> 'active|'");
    const file = { path: code ? 'Code.md' : 'Plain.md' };
    const codePosition = { start: { line: 0 }, end: { line: 2 } };
    // Simulate the previous global cache containing metadata for another note.
    Object.assign(plugin, { specialSections: code ? [] : [codePosition] });
    const getFileCache = vi.fn((target: unknown) => target === file
      ? { sections: code ? [{ type: 'code', position: codePosition }] : [] }
      : null);
    plugin.app = { ...plugin.app, metadataCache: { getFileCache } } as never;
    const state = EditorState.create({
      doc: '中文English,', selection: { anchor: '中文English,'.length },
      extensions: [editorInfoField.init(() => ({ file } as never))],
    });
    const tr = state.update({ changes: { from: 0, to: 1, insert: '中' } });
    const range = plugin.spotLibertyZone({ docChanged: tr.docChanged, state: tr.state, transactions: [tr] } as unknown as ViewUpdate);
    if (code) expect(range).toBeUndefined();
    else expect(range).toEqual({ from: 0, to: state.doc.length });
    expect(getFileCache).toHaveBeenCalledWith(file);
  });
});

function spacingUpdate(userEvent?: string, insert = ',') {
  const initial = 'Previous line\n😀 测试A4纸';
  const startState = EditorState.create({ doc: initial });
  const tr = startState.update({
    changes: { from: initial.length, insert },
    selection: { anchor: initial.length + insert.length },
    userEvent,
  });
  const dispatch = vi.fn();
  const update = {
    docChanged: tr.docChanged, changes: tr.changes,
    state: tr.state, selectionSet: true, transactions: [tr],
    view: { state: tr.state, dispatch },
  } as unknown as ViewUpdate;
  return { update, dispatch };
}

describe('applying a spacing plan', () => {
  it('shares the plan with the indicator and applies only the planned gaps', () => {
    const plugin = new TypingTransformer({} as never, {} as never);
    const { update, dispatch } = spacingUpdate('input.type');
    const free = vi.fn();
    const plan = vi.mocked(planLine).mockClear().mockReturnValueOnce({
      from: 0, to: 9, takeEdits: () => new Uint32Array([5, 5, 7, 7]), free, [Symbol.dispose]: free,
    });
    expect(plugin.spotLibertyZone(update)).toEqual({ from: 14, to: 23 });
    plugin.addLiberty(update);
    expect(plan).toHaveBeenCalledExactlyOnceWith('😀 测试A4纸,', 9);
    expect(free).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledOnce();
    const changes = dispatch.mock.calls[0][0].changes;
    expect(changes).toEqual([{ from: 19, to: 19, insert: ' ' }, { from: 21, to: 21, insert: ' ' }]);
    const after = update.state.update(dispatch.mock.calls[0][0]).state;
    expect(after.doc.toString()).toBe('Previous line\n😀 测试 A4 纸,');
    expect(after.selection.main.head).toBe(after.doc.length);
  });

  it.each([undefined, 'input.paste', 'undo', 'redo'])('ignores non-typing edits (%s)', event => {
    const plugin = new TypingTransformer({} as never, {} as never);
    const { update, dispatch } = spacingUpdate(event);
    vi.mocked(planLine).mockClear();
    plugin.addLiberty(update);
    expect(planLine).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not dispatch a second transaction when there are no gaps to change', () => {
    const plugin = new TypingTransformer({} as never, {} as never);
    const { update, dispatch } = spacingUpdate('input.type');
    vi.mocked(planLine).mockClear();
    plugin.addLiberty(update);
    expect(planLine).toHaveBeenCalledOnce();
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('rule validation must not change the active runtime', () => {
  it.each(["'broken|' ->", "'b|' -> 'draft|'"])(
    'keeps active rules while checking a draft: %s', async draft => {
      const plugin = await pluginWithRules("'a|' -> 'active|'");
      const active = plugin.rules;
      await plugin.checkRules(draft);
      expect(plugin.rules).toBe(active);
      expect((await plugin.rules.match('', 'a', 0))?.replace).toBe('active');
    },
  );

  it('returns validation errors without saving the draft', async () => {
    const plugin = await pluginWithRules("'a|' -> 'active|'");
    const save = vi.spyOn(plugin, 'saveSettings');
    expect(await plugin.checkRules("'broken|' ->")).not.toHaveLength(0);
    expect(save).not.toHaveBeenCalled();
  });
});
