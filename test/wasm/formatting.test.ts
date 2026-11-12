import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import init, { formatLine, getBlockRanges } from '../../liberty-web/charliberty';

beforeAll(async () => {
  const bytes = await readFile(new URL('../../liberty-web/charliberty_bg.wasm', import.meta.url));
  await init({ module_or_path: bytes });
});

describe('compiled Rust/WASM integration', () => {
  it('formats mixed Chinese and English text', () => {
    expect(formatLine('中文English。')).toBe('中文 English。');
  });
  it('keeps plain ASCII and an isolated URL unchanged', () => {
    expect(formatLine('hello world')).toBe('hello world');
    expect(formatLine('https://example.com/a?x=1')).toBe('https://example.com/a?x=1');
  });
  it('does not format the content of inline code', () => {
    expect(formatLine('`中文English`')).toBe('`中文English`');
  });
  it('is idempotent and preserves Unicode content', () => {
    const text = formatLine('中文😀English𐙟。');
    expect(formatLine(text)).toBe(text);
    expect(text.replaceAll(' ', '')).toBe('中文😀English𐙟。');
  });
  it('identifies inline-code ranges through the actual WASM boundary', () => {
    const blocks = getBlockRanges('test `code`', 10);
    expect(Array.from(blocks.special)).not.toHaveLength(0);
    blocks.free();
  });
});
