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

describe('SideRule (Selection Rules)', () => {
  describe('Basic selection rule parsing', () => {
    it('should parse simple selection rule', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'<' -> '<' + '>'", adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.sideInsertMap.size).toBe(1);
      expect(rules.sideInsertMap.has('<')).toBe(true);
    });

    it('should parse multiple selection rules', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      const ruleText = `
'<' -> '<' + '>'
'(' -> '(' + ')'
'[' -> '[' + ']'
      `.trim();

      await rules.parse(ruleText, adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.sideInsertMap.size).toBe(3);
      expect(rules.sideInsertMap.has('<')).toBe(true);
      expect(rules.sideInsertMap.has('(')).toBe(true);
      expect(rules.sideInsertMap.has('[')).toBe(true);
    });

    it('should parse selection rule with cursor in left part', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'q' -> 'left|Text' + 'right'", adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.sideInsertMap.has('q')).toBe(true);

      const rule = rules.sideInsertMap.get('q');
      expect(rule?.left).toBe('leftText');
      expect(rule?.right).toBe('right');
    });

    it('should parse selection rule with cursor in right part', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'l' -> '[' + '][|]'", adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.sideInsertMap.has('l')).toBe(true);

      const rule = rules.sideInsertMap.get('l');
      expect(rule?.left).toBe('[');
      // The right part has | marker removed, so '][|]' becomes '][]'
      expect(rule?.right).toBe('][]');
    });

    it('should parse selection rule with no cursor marker (defaults to end)', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'r' -> 'left' + 'right'", adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.sideInsertMap.has('r')).toBe(true);

      const rule = rules.sideInsertMap.get('r');
      expect(rule?.left).toBe('left');
      expect(rule?.right).toBe('right');
    });
  });

  describe('Cursor position calculation', () => {
    it('should calculate cursor position with cursor in left part', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'q' -> 'left|Text' + 'right'", adapter as any);

      const rule = rules.sideInsertMap.get('q');
      expect(rule).toBeDefined();

      // Selected text "abc" (length 3), basePos = 10
      // Final text: "leftTextabcright"
      // Cursor should be at: basePos + 4 (position of | in "left|Text")
      const cursorPos = rule!.calculateCursorPos(10, 3);
      expect(cursorPos).toBe(14);
    });

    it('should calculate cursor position with cursor in right part', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'l' -> '[' + '][|]'", adapter as any);

      const rule = rules.sideInsertMap.get('l');
      expect(rule).toBeDefined();

      // Selected text "hello" (length 5), basePos = 0
      // Final text: "[hello]["
      // Cursor should be at: basePos + 1 (left) + 5 (selected) + 2 (position in right before |)
      const cursorPos = rule!.calculateCursorPos(0, 5);
      expect(cursorPos).toBe(8);
    });

    it('should calculate cursor position at start of left part', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'w' -> '|prefix' + 'suffix'", adapter as any);

      const rule = rules.sideInsertMap.get('w');
      expect(rule).toBeDefined();

      // Selected text "xyz" (length 3), basePos = 5
      // Final text: "prefixxyzsuffix"
      // Cursor should be at: basePos + 0 (cursor at start of left)
      const cursorPos = rule!.calculateCursorPos(5, 3);
      expect(cursorPos).toBe(5);
    });

    it('should calculate cursor position at end (no marker)', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'r' -> 'left' + 'right'", adapter as any);

      const rule = rules.sideInsertMap.get('r');
      expect(rule).toBeDefined();

      // Selected text "test" (length 4), basePos = 0
      // Final text: "lefttestright"
      // Cursor should be at: basePos + 4 (left) + 4 (selected) + 5 (right)
      const cursorPos = rule!.calculateCursorPos(0, 4);
      expect(cursorPos).toBe(13);
    });

    it('should handle empty left part', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'e' -> '' + 'suffix|'", adapter as any);

      const rule = rules.sideInsertMap.get('e');
      expect(rule).toBeDefined();

      // Selected text "abc" (length 3), basePos = 10
      // Final text: "abcsuffix"
      // Cursor should be at: basePos + 0 (empty left) + 3 (selected) + 6 (position in right)
      const cursorPos = rule!.calculateCursorPos(10, 3);
      expect(cursorPos).toBe(19);
    });

    it('should handle empty right part', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'e' -> 'prefix|' + ''", adapter as any);

      const rule = rules.sideInsertMap.get('e');
      expect(rule).toBeDefined();

      // Selected text "xyz" (length 3), basePos = 5
      // Final text: "prefixxyz"
      // Cursor should be at: basePos + 6 (position of | in left)
      const cursorPos = rule!.calculateCursorPos(5, 3);
      expect(cursorPos).toBe(11);
    });
  });

  describe('Unicode and special characters in selection rules', () => {
    it('should handle Chinese characters', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'《' -> '《' + '》'", adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.sideInsertMap.has('《')).toBe(true);
    });

    it('should handle emoji triggers', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'😀' -> '【' + '】'", adapter as any);

      // Note: Some emojis might be counted as single character in JavaScript,
      // but the validation requires single character trigger.
      // If there's an error, it's expected behavior for multi-codepoint emojis
      if (rules.errors.length > 0) {
        expect(rules.errors[0]).toContain('single character');
      } else {
        expect(rules.sideInsertMap.has('😀')).toBe(true);
      }
    });

    it('should handle full-width characters', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'·' -> '`' + '`'", adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.sideInsertMap.has('·')).toBe(true);
    });

    it('should correctly calculate cursor position with unicode', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'《' -> '《|' + '》'", adapter as any);

      const rule = rules.sideInsertMap.get('《');
      expect(rule).toBeDefined();

      // Selected text "中文" (length 2), basePos = 0
      // Final text: "《中文》"
      // Cursor position should account for unicode character width
      const cursorPos = rule!.calculateCursorPos(0, 2);
      expect(cursorPos).toBe(1); // After 《
    });
  });

  describe('Selection rule validation', () => {
    it('should reject multi-character triggers', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'abc' -> 'left' + 'right'", adapter as any);

      expect(rules.errors.length).toBeGreaterThan(0);
      expect(rules.errors[0]).toContain("single character");
    });

    it('should reject multiple cursor markers', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'<' -> '<|' + '>|'", adapter as any);

      expect(rules.errors.length).toBeGreaterThan(0);
      expect(rules.errors[0]).toContain("at most one |");
    });

    it('should reject cursor markers on both sides', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'<' -> '|<' + '>|'", adapter as any);

      expect(rules.errors.length).toBeGreaterThan(0);
      expect(rules.errors[0]).toContain("at most one |");
    });

    it('should accept empty trigger for conversion rules but not selection', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      // This should fail because selection rules need single char trigger
      await rules.parse("'' -> 'left' + 'right'", adapter as any);

      expect(rules.errors.length).toBeGreaterThan(0);
    });
  });
});
