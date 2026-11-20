import { describe, expect, it, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import type { ViewUpdate } from '@codemirror/view';
import { editorViewField } from 'obsidian';
import TypingTransformer from '../../src/main';

// The manifest permits Obsidian 0.15, whose API has editorViewField only.
// Keep this module isolated so modern-API coverage remains independent.
vi.mock('obsidian', async importOriginal => ({
  ...await importOriginal<typeof import('obsidian')>(), editorInfoField: undefined,
}));
vi.mock('../../src/settings', () => ({
  BaseProfileName: 'Global', DEFAULT_SETTINGS: {}, SettingTab: class {},
}));
vi.mock('../../liberty-web/charliberty_bg.wasm', () => ({ default: new Uint8Array() }));
vi.mock('../../liberty-web/charliberty', () => ({
  default: vi.fn(),
  planLine: vi.fn((_line: string, to: number) => ({ from: 0, to, takeEdits: () => new Uint32Array(), free: vi.fn() })),
}));

describe('legacy editor metadata API', () => {
  it.each([false, true])('scopes formatting to its file when editorInfoField is unavailable (code=%s)', code => {
    const file = { path: 'Legacy.md' };
    const getFileCache = vi.fn(() => ({ sections: code ? [{
      type: 'code', position: { start: { line: 0 }, end: { line: 2 } },
    }] : [] }));
    const plugin = new TypingTransformer({} as never, {} as never);
    plugin.app = { metadataCache: { getFileCache } } as never;
    const state = EditorState.create({
      doc: '中文English,', selection: { anchor: '中文English,'.length },
      extensions: [editorViewField.init(() => ({ file } as never))],
    });
    const tr = state.update({ changes: { from: 0, to: 1, insert: '中' } });
    const range = plugin.spotLibertyZone({ docChanged: tr.docChanged, state: tr.state, transactions: [tr] } as unknown as ViewUpdate);
    expect(getFileCache).toHaveBeenCalledWith(file);
    if (code) expect(range).toBeUndefined();
    else expect(range).toEqual({ from: 0, to: state.doc.length });
  });
});
