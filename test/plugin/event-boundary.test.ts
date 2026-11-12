import { describe, expect, it, vi } from 'vitest';
import { ChangeSet, EditorState } from '@codemirror/state';
import type { ViewUpdate } from '@codemirror/view';
import TypingTransformer from '../../src/main';

// Keep the production plugin and its actual filters. Only replace UI/platform
// dependencies; rules and CodeMirror transactions remain real.
vi.mock('../../src/settings', () => ({
  BaseProfileName: 'Global', DEFAULT_SETTINGS: {}, SettingTab: class {},
}));
vi.mock('../../liberty-web/charliberty_bg.wasm', () => ({ default: new Uint8Array() }));
vi.mock('../../liberty-web/charliberty', () => ({
  default: vi.fn(), formatLine: (line: string) => line, getBlockRanges: vi.fn(),
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
