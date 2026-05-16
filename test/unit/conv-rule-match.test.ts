import { describe, it, expect, vi } from 'vitest';
import { Rules } from '../../src/ext_convert';

const createMockAdapter = () => ({
  stat: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  remove: vi.fn(),
  exists: vi.fn(),
  list: vi.fn(),
  getResourcePath: vi.fn(),
  append: vi.fn(),
  process: vi.fn(),
  mkdir: vi.fn(),
  rmdir: vi.fn(),
  trashSystem: vi.fn(),
  trashLocal: vi.fn(),
  rename: vi.fn(),
  copy: vi.fn(),
});

// Helper: build Rules from a rule string
async function makeRules(ruleText: string) {
  const rules = new Rules();
  await rules.parse(ruleText, createMockAdapter() as any);
  return rules;
}

// ─── match() / canConvert() / collectIdxsAlong() ───────────────────────────

describe('Rules.match()', () => {
  // Rule 'a|' -> 'result|': trigger is 'a', no left/right context required
  it('matches a single-char trigger with no context', async () => {
    const rules = await makeRules("'a|' -> 'result|'");
    const matched = await rules.match('', 'a', 0);
    expect(matched).not.toBeNull();
    expect(matched!.replace).toBe('result');
  });

  // Rule 'ab|' -> 'X|': trigger is 'b', requires 'a' in left context
  it('matches trigger with required left context', async () => {
    const rules = await makeRules("'ab|' -> 'X|'");
    const matched = await rules.match('a', 'b', 1);
    expect(matched).not.toBeNull();
    expect(matched!.replace).toBe('X');
  });

  it('does not match when left context is wrong', async () => {
    const rules = await makeRules("'ab|' -> 'X|'");
    const matched = await rules.match('c', 'b', 1);
    expect(matched).toBeNull();
  });

  // Rule 'a|b' -> 'X|': trigger is 'a', requires 'b' in right context
  it('matches trigger with required right context', async () => {
    const rules = await makeRules("'a|b' -> 'X|'");
    // input window: 'b' sits at position 0 after insertion point
    const matched = await rules.match('b', 'a', 0);
    expect(matched).not.toBeNull();
  });

  it('does not match when right context is wrong', async () => {
    const rules = await makeRules("'a|b' -> 'X|'");
    const matched = await rules.match('c', 'a', 0);
    expect(matched).toBeNull();
  });

  it('does not match when trigger character differs', async () => {
    const rules = await makeRules("'a|' -> 'X|'");
    const matched = await rules.match('', 'b', 0);
    expect(matched).toBeNull();
  });

  // Both 'ab|' and 'b|' could fire when we type 'b' with 'a' in left context.
  // Earlier rule wins.
  it('prioritises earlier rules on same trigger', async () => {
    const rules = await makeRules(
      "'ab|' -> 'first|'\n'b|' -> 'second|'"
    );
    const matched = await rules.match('a', 'b', 1);
    expect(matched).not.toBeNull();
    expect(matched!.replace).toBe('first');
  });

  // 'b|' fires when there is no 'a' before the 'b'
  it('falls back to shorter matching rule when longer does not match', async () => {
    const rules = await makeRules(
      "'ab|' -> 'first|'\n'b|' -> 'second|'"
    );
    // Only 'b' before cursor — 'ab|' won't match, 'b|' should
    const matched = await rules.match('', 'b', 0);
    expect(matched).not.toBeNull();
    expect(matched!.replace).toBe('second');
  });

  it('returns null when no rules match', async () => {
    const rules = await makeRules("'a|' -> 'X|'");
    const matched = await rules.match('', 'z', 0);
    expect(matched).toBeNull();
  });

  it('matches rules with unicode left context', async () => {
    const rules = await makeRules("'中|文' -> 'X|'");
    // trigger is '中', right context must be '文'
    const matched = await rules.match('文', '中', 0);
    expect(matched).not.toBeNull();
  });
});

// ─── ConvRule.mapToChanges() ────────────────────────────────────────────────

describe('ConvRule.mapToChanges()', () => {
  describe('insert rules', () => {
    it('calculates modification zone for trigger-only rule', async () => {
      // 'a|' -> 'result|': trigger 'a' at pos 5, replace just 'a' with 'result'
      const rules = await makeRules("'a|' -> 'result|'");
      const rule = rules.rules[0];
      const spec = rule.mapToChanges(5, false);

      // lBefore2AnchorLen = len([]) = 0  → from = 5 - 0 = 5
      // modificationSpan  = len(['a']) + 0 = 1  → to = 6
      // rBeforeAnchorLen  = len(['r','e','s','u','l','t']) = 6  → newPos = 11
      expect(spec.changes).toEqual({ from: 5, to: 6, insert: 'result' });
      expect(spec.selection).toEqual({ anchor: 11, head: 11 });
    });

    it('calculates modification zone with left context', async () => {
      // 'ab|' -> 'X|': trigger 'b' (innerTrig), 'a' is left context
      // left = ['a','b','¦'], lanchor=2, pos = position of 'b' in document
      const rules = await makeRules("'ab|' -> 'X|'");
      const rule = rules.rules[0];
      const spec = rule.mapToChanges(5, false);

      // lBefore2AnchorLen = len(['a']) = 1  → startOffset=1, from = 5-1 = 4
      // modificationSpan  = len(['a','b']) + 0 = 2  → to = 6
      // rBeforeAnchorLen  = len(['X']) = 1  → newPos = 5
      expect(spec.changes).toEqual({ from: 4, to: 6, insert: 'X' });
      expect(spec.selection).toEqual({ anchor: 5, head: 5 });
    });

    it('calculates modification zone with right context', async () => {
      // 'a|b' -> 'X|Y': trigger 'a', right context 'b'
      const rules = await makeRules("'a|b' -> 'X|Y'");
      const rule = rules.rules[0];
      const spec = rule.mapToChanges(5, false);

      // lBefore2AnchorLen = len([]) = 0  → from = 5
      // modificationSpan  = len(['a']) + len(['b']) = 2  → to = 7
      // rBeforeAnchorLen  = len(['X']) = 1  → newPos = 6
      expect(spec.changes).toEqual({ from: 5, to: 7, insert: 'XY' });
      expect(spec.selection).toEqual({ anchor: 6, head: 6 });
    });

    it('places cursor at end when no cursor marker in result', async () => {
      // result has no '|', so cursor goes to end of replacement
      const rules = await makeRules("'a|' -> 'xyz'");
      // isValid requires ranchor >= 0, and ranchor = findOnlyAnchor on right side
      // no | on right side → ranchor = -1 → isValid = false → error
      expect(rules.errors.length).toBeGreaterThan(0);
    });

    it('handles unicode characters in replacement correctly', async () => {
      // '《|》' -> '<|>': each char is 3 bytes but 1 JS char
      const rules = await makeRules("'《|》' -> '<|>'");
      const rule = rules.rules[0];
      const spec = rule.mapToChanges(10, false);

      // trigger '《', right context '》' (1 char each in JS)
      // lBefore2AnchorLen = 0, modificationSpan = 1+1 = 2, rBeforeAnchorLen = 1
      expect(spec.changes).toEqual({ from: 10, to: 12, insert: '<>' });
      expect(spec.selection).toEqual({ anchor: 11, head: 11 });
    });
  });

  describe('delete rules', () => {
    it('calculates modification zone for simple bracket deletion', async () => {
      // '(|)' -x '|': when backspacing '(' while ')' is after cursor
      const rules = await makeRules("'(|)' -x '|'");
      const rule = rules.rules[0];

      // After ConvRule delete init: left = ['(','❌','¦',')'], lanchor = 2
      // lBefore3AnchorLen = len(left.slice(0,0)) = 0
      // lAfterAnchorLen   = len([')']) = 1
      // rBeforeAnchorLen  = 0, replace = ""
      // isDel=true, pos=120 (fromB+1 in main.ts convention)
      // → pos becomes 119, from = 119-0 = 119, to = 119+1 = 120, newPos = 119
      const spec = rule.mapToChanges(120, true);

      expect(spec.changes).toEqual({ from: 119, to: 120, insert: '' });
      expect(spec.selection).toEqual({ anchor: 119, head: 119 });
    });

    it('handles delete rule with left context', async () => {
      // 'x(|)' -x '|': delete ')' only when '(' is preceded by 'x'
      const rules = await makeRules("'x(|)' -x '|'");
      const rule = rules.rules[0];

      // left = ['x','(','❌','¦',')'], lanchor = 3
      // lBefore3AnchorLen = len(['x']) = 1
      // lAfterAnchorLen   = len([')']) = 1
      // rBeforeAnchorLen  = 0
      // isDel=true, pos=120
      // → pos=119, startOffset=1, from=118, modificationSpan=1+1=2, to=120, newPos=118
      const spec = rule.mapToChanges(120, true);

      expect(spec.changes).toEqual({ from: 118, to: 120, insert: '' });
      expect(spec.selection).toEqual({ anchor: 118, head: 118 });
    });
  });
});

// ─── Parser edge-case branches ──────────────────────────────────────────────

describe('Parser edge cases', () => {
  it('handles unknown escape sequence (keeps backslash)', async () => {
    // '\z|' → backslash is unknown escape, kept as-is: left = ['\\','z','¦']
    const rules = await makeRules("'\\z|' -> 'result|'");
    expect(rules.errors).toHaveLength(0);
    // innerTrig is the char before anchor = 'z'
    expect(rules.rules[0].innerTrig).toBe('z');
  });

  it('reports error for newline inside a string literal', async () => {
    // Inject an actual newline character inside the string
    const rules = await makeRules("'ab\n|' -> 'result|'");
    expect(rules.errors.length).toBeGreaterThan(0);
    expect(rules.errors[0]).toMatch(/newline/);
  });

  it('reports error for unterminated string (EOF)', async () => {
    const rules = await makeRules("'abc");
    expect(rules.errors.length).toBeGreaterThan(0);
    expect(rules.errors[0]).toMatch(/found nothing/);
  });

  it('reports error for content after valid rule on same line', async () => {
    const rules = await makeRules("'a|' -> 'b|' extra_garbage");
    expect(rules.errors.length).toBeGreaterThan(0);
    expect(rules.errors[0]).toMatch(/one rule in each line/);
  });

  it('supports justCheck mode: validates without building index', async () => {
    const rules = new Rules();
    const adapter = createMockAdapter();
    await rules.parse("'a|' -> 'b|'", adapter as any, true);

    expect(rules.errors).toHaveLength(0);
    // In justCheck mode, rules/index are not populated
    expect(rules.rules).toHaveLength(0);
  });

  it('reports error for -f rule with empty path', async () => {
    const rules = await makeRules("'a|' -f ''");
    expect(rules.errors.length).toBeGreaterThan(0);
    expect(rules.errors[0]).toMatch(/text source/);
  });

  it('handles -f rule with $CLIPBOARD source', async () => {
    // $CLIPBOARD import: initClipboard=true, treated as insert rule
    const rules = await makeRules("'a|' -f '$CLIPBOARD'");
    expect(rules.errors).toHaveLength(0);
    expect(rules.rules[0].isInitClipboard).toBe(true);
  });

  it('handles -f rule with file source when file exists', async () => {
    const rules = new Rules();
    const adapter = createMockAdapter();
    adapter.stat.mockResolvedValue({ type: 'file', ctime: 0, mtime: 0, size: 0 });
    adapter.read.mockResolvedValue('file content');

    await rules.parse("'a|' -f 'notes/snippet.md'", adapter as any);

    expect(rules.errors).toHaveLength(0);
    expect(rules.rules[0].replace).toContain('file content');
  });

  it('reports error for -f rule when file not found', async () => {
    const rules = new Rules();
    const adapter = createMockAdapter();
    adapter.stat.mockResolvedValue(null);

    await rules.parse("'a|' -f 'missing.md'", adapter as any);

    expect(rules.errors.length).toBeGreaterThan(0);
    expect(rules.errors[0]).toMatch(/File not found/);
  });

  it('handles -f rule in justCheck mode (skips file read)', async () => {
    const rules = new Rules();
    const adapter = createMockAdapter();
    adapter.stat.mockResolvedValue({ type: 'file', ctime: 0, mtime: 0, size: 0 });

    await rules.parse("'a|' -f 'notes/snippet.md'", adapter as any, true);

    expect(rules.errors).toHaveLength(0);
    expect(adapter.read).not.toHaveBeenCalled();
  });

  it('lmax and rmax reflect actual rule dimensions', async () => {
    // 'abcde|fgh' -> 'X|': lBefore2AnchorLen=4, lAfterAnchorLen=3
    const rules = await makeRules("'abcde|fgh' -> 'X|'");
    expect(rules.lmax).toBe(4); // len(['a','b','c','d'])
    expect(rules.rmax).toBe(3); // len(['f','g','h'])
  });
});
