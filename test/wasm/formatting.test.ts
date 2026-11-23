import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import init, { planLine } from '../../liberty-web/charliberty';

beforeAll(async () => {
  const bytes = await readFile(new URL('../../liberty-web/charliberty_bg.wasm', import.meta.url));
  await init({ module_or_path: bytes });
});

function plan(text: string, cursor = text.length) {
  const result = planLine(text, cursor);
  if (!result) return undefined;
  try {
    return { from: result.from, to: result.to, edits: Array.from(result.takeEdits()) };
  } finally {
    result.free();
  }
}

describe('compiled Rust/WASM integration', () => {
  it('returns exact inserts and deletes before the cursor in UTF-16', () => {
    const before = '😀 测试A4纸 。';
    expect(plan(before + '不改API', before.length)).toEqual({
      from: 0, to: before.length, edits: [5, 5, 7, 7, 8, 9],
    });
    expect(plan('𠮷API。')).toEqual({ from: 0, to: 6, edits: [2, 2] });
    expect(plan(before, 1)).toBeUndefined();
  });

  it.each([
    ['😀`中文ABC,', '`'],
    ['1`中文ABC,', '`'],
    ['😀``中文`ABC,', '``'],
    ['`中文English,', ''],
    ['[中文ABC,', '](https://example.com/a(b))'],
    ['https://example.com/a?', 'x=1'],
  ])('protects %s with suffix %s', (before, after) => {
    expect(plan(before + after, before.length)).toBeUndefined();
  });

  it('separates only Han boundaries and keeps a dotted version together', () => {
    const before = '旧段API，版本v2.1.3发布。';
    expect(plan(before + '后段API', before.length)).toEqual({
      from: 5, to: before.length, edits: [8, 8, 14, 14],
    });
    expect(plan('版本 v2.1.3 发布。')?.edits).toEqual([]);
  });

  it('keeps underscore identifiers intact even when several share a sentence', () => {
    const text = '函数p_cache和q_cache。';
    expect(plan(text)?.edits).toEqual([2, 2, 9, 9, 10, 10]);
    expect(plan('函数 p_cache 和 q_cache。')?.edits).toEqual([]);
    expect(plan('这是 _p_cache_ 文档。')?.edits).toEqual([]);
  });

  it('keeps existing spacing around emphasis without modifying its markers', () => {
    expect(plan('这是**API**文档。')?.edits).toEqual([2, 2, 9, 9]);
    const before = '这是**中文API，';
    expect(plan(before + '**文档。', before.length)).toEqual({
      from: 4, to: before.length, edits: [6, 6],
    });
  });

  it.each(['hello world,', '中文  English。', '中文😀English𐙟。'])('emits no edits for %s', text => {
    expect(plan(text)?.edits).toEqual([]);
  });
});
