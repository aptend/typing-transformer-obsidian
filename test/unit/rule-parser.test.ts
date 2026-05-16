import { describe, it, expect, vi } from 'vitest';
import { Rules } from '../../src/ext_convert';

// Mock DataAdapter for testing
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

describe('Rule Parser', () => {
  describe('Basic rule parsing', () => {
    it('should parse a simple conversion rule', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'dp|x' -> 'don\\'t panic|'", adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.rules).toHaveLength(1);
      expect(rules.rules[0].isValid).toBe(true);
    });

    it('should parse multiple rules separated by newlines', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      const ruleText = `
'dp|x' -> 'don\\'t panic|'
'《|》' -> '<|>'
      `.trim();

      await rules.parse(ruleText, adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.rules).toHaveLength(2);
    });

    it('should handle comments correctly', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      const ruleText = `
# This is a comment
'dp|x' -> 'don\\'t panic|'  # inline comment
# Another comment
'test|' -> 'result|'
      `.trim();

      await rules.parse(ruleText, adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.rules).toHaveLength(2);
    });

    it('should parse selection rules with + operator', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'<' -> '<' + '>'", adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.sideInsertMap.size).toBe(1);
      expect(rules.sideInsertMap.has('<')).toBe(true);
    });

    it('should parse deletion rules with -x', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'(|)' -x '|'", adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.rules).toHaveLength(1);
      expect(rules.rules[0].isForDelete).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should report error for missing left quote', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("dp|x' -> 'result|'", adapter as any);

      expect(rules.errors.length).toBeGreaterThan(0);
      expect(rules.errors[0]).toContain("Expected a rule starting with '");
    });

    it('should report error for missing right quote', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'dp|x -> 'result|'", adapter as any);

      expect(rules.errors.length).toBeGreaterThan(0);
      // The error might be about arrow or ending quote depending on where parser stops
      expect(rules.errors[0]).toMatch(/Expected.*('|->)/);
    });

    it('should report error for missing anchor on left side', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'dpx' -> 'result|'", adapter as any);

      expect(rules.errors.length).toBeGreaterThan(0);
      expect(rules.errors[0]).toContain("Expected one | on left side");
    });

    it('should report error for missing anchor on right side', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'dp|x' -> 'result'", adapter as any);

      expect(rules.errors.length).toBeGreaterThan(0);
      expect(rules.errors[0]).toContain("Expected one | on right side");
    });

    it('should report error for multiple anchors on left side', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'d|p|x' -> 'result|'", adapter as any);

      expect(rules.errors.length).toBeGreaterThan(0);
      expect(rules.errors[0]).toContain("multiple");
    });

    it('should report error for anchor at start of left side', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'|dpx' -> 'result|'", adapter as any);

      expect(rules.errors.length).toBeGreaterThan(0);
      expect(rules.errors[0]).toContain("cannot start with |");
    });

    it('should report error for invalid arrow', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'dp|x' => 'result|'", adapter as any);

      expect(rules.errors.length).toBeGreaterThan(0);
      expect(rules.errors[0]).toContain("Expected ->, -x or -f");
    });

    it('should report error for selection rule with -x', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'<' -x '<' + '>'", adapter as any);

      expect(rules.errors.length).toBeGreaterThan(0);
      expect(rules.errors[0]).toContain("selection rules cannot be deletion rules");
    });

    it('should report error for multi-character selection trigger', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'abc' -> '<' + '>'", adapter as any);

      expect(rules.errors.length).toBeGreaterThan(0);
      expect(rules.errors[0]).toContain("single character");
    });
  });

  describe('Special characters and escaping', () => {
    it('should handle escaped quotes', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'\\\'|' -> 'result|'", adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.rules).toHaveLength(1);
    });

    it('should handle escaped backslashes', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'\\\\|' -> 'result|'", adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.rules).toHaveLength(1);
    });

    it('should handle escaped newlines', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'\\n|' -> 'result|'", adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.rules).toHaveLength(1);
    });

    it('should handle escaped anchor marker', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'\\||test' -> 'result|'", adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.rules).toHaveLength(1);
    });

    it('should handle unicode characters', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'中|文' -> '汉字|'", adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.rules).toHaveLength(1);
    });

    it('should handle emoji characters', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'😀|' -> '🎉|'", adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.rules).toHaveLength(1);
    });
  });

  describe('Rule structure validation', () => {
    it('should create valid ConvRule for simple conversion', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'dp|x' -> 'don\\'t panic|'", adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.rules).toHaveLength(1);

      const rule = rules.rules[0];
      expect(rule.isValid).toBe(true);
      // innerTrig is the character before |, which is 'p' in 'dp|'
      expect(rule.innerTrig).toBe('p');
      expect(rule.replace).toBe("don't panic");
      expect(rule.isForDelete).toBe(false);
      // trigHintChar is used for trigger set, it's the actual trigger for matching
      expect(rule.trigHintChar).toBe('p');
    });

    it('should create valid ConvRule for deletion rule', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'(|)' -x '|'", adapter as any);

      expect(rules.errors).toHaveLength(0);
      expect(rules.rules).toHaveLength(1);

      const rule = rules.rules[0];
      expect(rule.isValid).toBe(true);
      expect(rule.isForDelete).toBe(true);
      expect(rule.replace).toBe('');
    });

    it('should store left and right parts correctly', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      await rules.parse("'abc|def' -> 'result|here'", adapter as any);

      const rule = rules.rules[0];
      expect(rule.left).toEqual(['a', 'b', 'c', '¦', 'd', 'e', 'f']);
      expect(rule.lanchor).toBeGreaterThan(0);
    });
  });

  describe('Trigger character sets', () => {
    it('should collect insert trigger characters', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      const ruleText = `
'a|b' -> 'result1|'
'c|d' -> 'result2|'
      `.trim();

      await rules.parse(ruleText, adapter as any);

      expect(rules.insertTrigSet.has('a')).toBe(true);
      expect(rules.insertTrigSet.has('c')).toBe(true);
      expect(rules.insertTrigSet.size).toBe(2);
    });

    it('should collect delete trigger characters', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      const ruleText = `
'a|b' -x 'result1|'
'c|d' -x 'result2|'
      `.trim();

      await rules.parse(ruleText, adapter as any);

      expect(rules.deleteTrigSet.has('a')).toBe(true);
      expect(rules.deleteTrigSet.has('c')).toBe(true);
      expect(rules.deleteTrigSet.size).toBe(2);
    });

    it('should distinguish between insert and delete triggers', async () => {
      const rules = new Rules();
      const adapter = createMockAdapter();

      const ruleText = `
'a|b' -> 'insert|'
'c|d' -x 'delete|'
      `.trim();

      await rules.parse(ruleText, adapter as any);

      expect(rules.insertTrigSet.has('a')).toBe(true);
      expect(rules.deleteTrigSet.has('c')).toBe(true);
      expect(rules.insertTrigSet.has('c')).toBe(false);
      expect(rules.deleteTrigSet.has('a')).toBe(false);
    });
  });
});
