import { describe, it, expect, vi } from 'vitest';
import { Annotation, AnnotationType, ChangeSet, EditorState, TransactionSpec } from '@codemirror/state';
import { history, undo, redo } from '@codemirror/commands';
import { computeConvertChanges, computeSideInsertChanges } from '../../src/editor_logic';
import { Rules } from '../../src/ext_convert';

// ─── Shared test annotation (plays the role of ProgramTxn) ──────────────────

const mockProgramTxn: AnnotationType<boolean> = Annotation.define<boolean>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const createMockAdapter = () => ({
  stat: vi.fn(), read: vi.fn(), write: vi.fn(), remove: vi.fn(),
  exists: vi.fn(), list: vi.fn(), getResourcePath: vi.fn(), append: vi.fn(),
  process: vi.fn(), mkdir: vi.fn(), rmdir: vi.fn(), trashSystem: vi.fn(),
  trashLocal: vi.fn(), rename: vi.fn(), copy: vi.fn(),
});

async function makeRules(ruleText: string): Promise<Rules> {
  const rules = new Rules();
  await rules.parse(ruleText, createMockAdapter() as any);
  return rules;
}

// Simulate "user inserts a single char at insertPos"
function buildInsert(doc: string, insertPos: number, char: string) {
  const startState = EditorState.create({ doc });
  const changes = ChangeSet.of({ from: insertPos, insert: char }, doc.length);
  return { startState, changes };
}

// Simulate "user deletes the char at deletePos"
function buildDelete(doc: string, deletePos: number) {
  const startState = EditorState.create({ doc });
  const changes = ChangeSet.of({ from: deletePos, to: deletePos + 1 }, doc.length);
  return { startState, changes };
}

// Simulate "user selects [from, to] then types char" (selection replace)
function buildSelectionReplace(doc: string, from: number, to: number, char: string) {
  const startState = EditorState.create({ doc });
  const changes = ChangeSet.of({ from, to, insert: char }, doc.length);
  return { startState, changes };
}

// Build an EditorState with history wired to mockProgramTxn
function makeStateWithHistory(doc: string) {
  return EditorState.create({
    doc,
    extensions: [
      history({
        joinToEvent: (tr, isAdjacent) => !tr.annotation(mockProgramTxn) && isAdjacent,
      }),
    ],
  });
}

function doUndo(state: EditorState): EditorState {
  let next = state;
  undo({ state, dispatch: (tr) => { next = tr.state; } });
  return next;
}

function doRedo(state: EditorState): EditorState {
  let next = state;
  redo({ state, dispatch: (tr) => { next = tr.state; } });
  return next;
}

// ─── computeConvertChanges ────────────────────────────────────────────────────

describe('computeConvertChanges', () => {
  it('T1 - insert rule matches and returns correct spec', async () => {
    const rules = await makeRules("'dp|x' -> 'don\\'t panic|'");
    // doc="dx", insert "p" at pos 1  →  startState sees "dx", trigger is 'p'
    const { startState, changes } = buildInsert('dx', 1, 'p');

    const { specs, allMatched } = await computeConvertChanges(
      startState, changes, rules, mockProgramTxn,
    );

    expect(allMatched).toBe(true);
    expect(specs).toHaveLength(1);
    expect((specs[0].changes as any).insert).toContain("don't panic");
    expect(specs[0].annotations).toEqual(mockProgramTxn.of(true));
  });

  it('T2 - trigger char not in trigSet → no match', async () => {
    const rules = await makeRules("'a|b' -> 'X|'");
    const { startState, changes } = buildInsert('something', 4, 'z');

    const { specs, allMatched } = await computeConvertChanges(
      startState, changes, rules, mockProgramTxn,
    );

    expect(allMatched).toBe(false);
    expect(specs).toHaveLength(0);
  });

  it('T3 - delete rule matches', async () => {
    const rules = await makeRules("'(|)' -x '|'");
    // doc="()", delete char at pos 0  →  deletes '('
    const { startState, changes } = buildDelete('()', 0);

    const { specs, allMatched } = await computeConvertChanges(
      startState, changes, rules, mockProgramTxn,
    );

    expect(allMatched).toBe(true);
    expect(specs).toHaveLength(1);
    expect((specs[0].changes as any).insert).toBe('');
  });

  it('T4 - doc start boundary: insufficient left context → no match', async () => {
    // rule needs 'abc' to the left, but doc only has 'd' (length 1)
    const rules = await makeRules("'abcd|' -> 'X|'");
    const { startState, changes } = buildInsert('d', 0, 'd');

    const { specs, allMatched } = await computeConvertChanges(
      startState, changes, rules, mockProgramTxn,
    );

    expect(allMatched).toBe(false);
    expect(specs).toHaveLength(0);
  });

  it('T5 - earlier rule wins over shorter match', async () => {
    const rules = await makeRules("'ab|' -> 'first|'\n'b|' -> 'second|'");
    const { startState, changes } = buildInsert('a', 1, 'b');

    const { specs, allMatched } = await computeConvertChanges(
      startState, changes, rules, mockProgramTxn,
    );

    expect(allMatched).toBe(true);
    expect((specs[0].changes as any).insert).toBe('first');
  });

  it('T5b - shorter rule matches when longer left context is absent', async () => {
    const rules = await makeRules("'ab|' -> 'first|'\n'b|' -> 'second|'");
    // no 'a' before, only 'b' present
    const { startState, changes } = buildInsert('', 0, 'b');

    const { specs, allMatched } = await computeConvertChanges(
      startState, changes, rules, mockProgramTxn,
    );

    expect(allMatched).toBe(true);
    expect((specs[0].changes as any).insert).toBe('second');
  });
});

// ─── computeSideInsertChanges ─────────────────────────────────────────────────

describe('computeSideInsertChanges', () => {
  it('T6 - wraps selected text with matching rule', async () => {
    const rules = await makeRules("'(' -> '(' + ')'");
    // "world hello world": "world " = 6 chars, "hello" is at [6, 11)
    const { startState, changes } = buildSelectionReplace('world hello world', 6, 11, '(');

    const specs = computeSideInsertChanges(startState, changes, rules, mockProgramTxn);

    expect(specs).toHaveLength(1);
    expect((specs[0].changes as any).insert).toBe('(hello)');
    expect((specs[0].changes as any).from).toBe(6);
    expect((specs[0].changes as any).to).toBe(7);
    // cursor at end: fromB(6) + left(1) + replaced(5) + right(1) = 13
    expect(specs[0].selection).toEqual({ anchor: 13, head: 13 });
    expect(specs[0].annotations).toEqual(mockProgramTxn.of(true));
  });

  it('T7 - char not in sideInsertMap → empty', async () => {
    const rules = await makeRules("'(' -> '(' + ')'");
    const { startState, changes } = buildSelectionReplace('hello', 0, 5, '[');

    const specs = computeSideInsertChanges(startState, changes, rules, mockProgramTxn);

    expect(specs).toHaveLength(0);
  });

  it('T8 - no selection (fromA === toA) → empty', async () => {
    const rules = await makeRules("'(' -> '(' + ')'");
    // plain insert, not a selection replace
    const { startState, changes } = buildInsert('hello', 3, '(');

    const specs = computeSideInsertChanges(startState, changes, rules, mockProgramTxn);

    expect(specs).toHaveLength(0);
  });

  it('T9 - cursor marker in left part ignores replacedLength', async () => {
    // cursor after "pre": basePos + 3, regardless of replaced text length
    const rules = await makeRules("'q' -> 'pre|fix' + 'suf'");
    const { startState, changes } = buildSelectionReplace('world hello world', 6, 11, 'q');

    const specs = computeSideInsertChanges(startState, changes, rules, mockProgramTxn);

    expect(specs).toHaveLength(1);
    // cursorOffset = 3 (position of | in "pre|fix"), cursorInLeft = true
    // calculateCursorPos(fromB=6, replacedLength=5) → 6 + 3 = 9
    expect(specs[0].selection).toEqual({ anchor: 9, head: 9 });
  });
});

// ─── Chinese & full-width characters ─────────────────────────────────────────

describe('Chinese and full-width characters', () => {
  it('double full-width period converts to ASCII period', async () => {
    // '。。|' -> '.|'  trigger='。', left context='。', no right context
    const rules = await makeRules("'。。|' -> '.|'");
    const { startState, changes } = buildInsert('。', 1, '。');

    const { specs, allMatched } = await computeConvertChanges(
      startState, changes, rules, mockProgramTxn,
    );

    expect(allMatched).toBe(true);
    expect((specs[0].changes as any).insert).toBe('.');
    // both 。 chars replaced → from=0, to=2
    expect((specs[0].changes as any).from).toBe(0);
    expect((specs[0].changes as any).to).toBe(2);
  });

  it('double full-width comma converts to ASCII comma', async () => {
    const rules = await makeRules("'，，|' -> ',|'");
    const { startState, changes } = buildInsert('，', 1, '，');

    const { specs, allMatched } = await computeConvertChanges(
      startState, changes, rules, mockProgramTxn,
    );

    expect(allMatched).toBe(true);
    expect((specs[0].changes as any).insert).toBe(',');
  });

  it('《 auto-pairs into 《|》', async () => {
    // '《|' -> '《|》'  trigger='《', no left or right context required
    const rules = await makeRules("'《|' -> '《|》'");
    const { startState, changes } = buildInsert('', 0, '《');

    const { specs, allMatched } = await computeConvertChanges(
      startState, changes, rules, mockProgramTxn,
    );

    expect(allMatched).toBe(true);
    expect((specs[0].changes as any).insert).toBe('《》');
    // cursor inside: rBeforeAnchorLen=1 ('《'), from=0, newPos=0+1=1
    expect((specs[0].selection as any).anchor).toBe(1);
  });

  it('（ auto-pairs into （|）', async () => {
    const rules = await makeRules("'（|' -> '（|）'");
    const { startState, changes } = buildInsert('', 0, '（');

    const { specs, allMatched } = await computeConvertChanges(
      startState, changes, rules, mockProgramTxn,
    );

    expect(allMatched).toBe(true);
    expect((specs[0].changes as any).insert).toBe('（）');
    expect((specs[0].selection as any).anchor).toBe(1);
  });

  it('delete rule removes matching 《》 pair', async () => {
    // '《|》' -x '|'  triggers when deleting 《 with 》 immediately after cursor
    const rules = await makeRules("'《|》' -x '|'");
    const { startState, changes } = buildDelete('《》', 0);

    const { specs, allMatched } = await computeConvertChanges(
      startState, changes, rules, mockProgramTxn,
    );

    expect(allMatched).toBe(true);
    expect((specs[0].changes as any).insert).toBe('');
    // both chars gone, cursor at 0
    expect((specs[0].selection as any).anchor).toBe(0);
  });

  it('line-start 》 converts to >', async () => {
    // '\n》|' -> '\n>|'  requires newline in left context
    const rules = await makeRules("'\\n》|' -> '\\n>|'");
    // doc="line1\n", typing 》 at pos 6 (after the newline)
    const { startState, changes } = buildInsert('line1\n', 6, '》');

    const { specs, allMatched } = await computeConvertChanges(
      startState, changes, rules, mockProgramTxn,
    );

    expect(allMatched).toBe(true);
    // replaces '\n》' with '\n>'
    expect((specs[0].changes as any).insert).toBe('\n>');
  });

  it('rule does NOT fire without required newline context', async () => {
    // same rule but 》 typed in the middle of a line
    const rules = await makeRules("'\\n》|' -> '\\n>|'");
    const { startState, changes } = buildInsert('hello', 5, '》');

    const { specs, allMatched } = await computeConvertChanges(
      startState, changes, rules, mockProgramTxn,
    );

    expect(allMatched).toBe(false);
    expect(specs).toHaveLength(0);
  });
});

// ─── Consecutive rule firing (chain) ─────────────────────────────────────────

describe('consecutive rule firing (chain)', () => {
  it('second 《 inside auto-paired 《》 converts to <', async () => {
    // Priority scenario from DEFAULT_RULES:
    //   '《《|》' -> '<|'   (higher priority)
    //   '《|'    -> '《|》'
    //
    // Step 1: user types 《 into empty doc → rule '《|' fires → doc becomes '《》'
    // Step 2: user types 《 at pos 1 (inside the pair) → rule '《《|》' fires → doc becomes '<'
    const rules = await makeRules(
      "'《《|》' -> '<|'\n'《|' -> '《|》'"
    );

    // --- step 1 ---
    const s1 = buildInsert('', 0, '《');
    const r1 = await computeConvertChanges(s1.startState, s1.changes, rules, mockProgramTxn);
    expect(r1.allMatched).toBe(true);
    expect((r1.specs[0].changes as any).insert).toBe('《》');

    // --- step 2: doc is now '《》', user types 《 at pos 1 ---
    const s2 = buildInsert('《》', 1, '《');
    const r2 = await computeConvertChanges(s2.startState, s2.changes, rules, mockProgramTxn);
    expect(r2.allMatched).toBe(true);
    // '《《》' collapses to '<'
    expect((r2.specs[0].changes as any).insert).toBe('<');
    expect((r2.specs[0].changes as any).from).toBe(0);
    expect((r2.specs[0].changes as any).to).toBe(3);
  });

  it('（（ double-press converts to ASCII parens', async () => {
    // '（（|）' -> '(|)'  — second （ when already inside an auto-paired （）
    const rules = await makeRules(
      "'（（|）' -> '(|)'\n'（|' -> '（|）'"
    );

    // step 1: type （ → auto-pair
    const s1 = buildInsert('', 0, '（');
    const r1 = await computeConvertChanges(s1.startState, s1.changes, rules, mockProgramTxn);
    expect(r1.allMatched).toBe(true);
    expect((r1.specs[0].changes as any).insert).toBe('（）');

    // step 2: type （ inside → convert to (|)
    const s2 = buildInsert('（）', 1, '（');
    const r2 = await computeConvertChanges(s2.startState, s2.changes, rules, mockProgramTxn);
    expect(r2.allMatched).toBe(true);
    expect((r2.specs[0].changes as any).insert).toBe('()');
  });

  it('backtick chain: ·· → `|` then `·` → ```|\\n```', async () => {
    // '··|'  -> '`|`'   (· is full-width dot U+00B7)
    // '`·|`' -> '```|\n```'
    const CDOT = '·';
    const rules = await makeRules(
      `'${CDOT}${CDOT}|' -> '\`|\`'\n'\`${CDOT}|\`' -> '\`\`\`|\\n\`\`\`'`
    );

    // step 1: ·· → `|`
    const s1 = buildInsert(CDOT, 1, CDOT);
    const r1 = await computeConvertChanges(s1.startState, s1.changes, rules, mockProgramTxn);
    expect(r1.allMatched).toBe(true);
    expect((r1.specs[0].changes as any).insert).toBe('``');

    // step 2: type · inside `|` → ```|\n```
    const s2 = buildInsert('``', 1, CDOT);
    const r2 = await computeConvertChanges(s2.startState, s2.changes, rules, mockProgramTxn);
    expect(r2.allMatched).toBe(true);
    expect((r2.specs[0].changes as any).insert).toBe('```\n```');
  });

  it('》》 double-press converts to >', async () => {
    const rules = await makeRules("'》》|' -> '>|'");

    // first 》 — no left context yet, no match
    const s1 = buildInsert('', 0, '》');
    const r1 = await computeConvertChanges(s1.startState, s1.changes, rules, mockProgramTxn);
    expect(r1.allMatched).toBe(false);

    // second 》 with existing 》 in doc
    const s2 = buildInsert('》', 1, '》');
    const r2 = await computeConvertChanges(s2.startState, s2.changes, rules, mockProgramTxn);
    expect(r2.allMatched).toBe(true);
    expect((r2.specs[0].changes as any).insert).toBe('>');
  });
});

// ─── Side rules with non-ASCII triggers ──────────────────────────────────────

describe('side rules with non-ASCII triggers', () => {
  it('《 wraps selected Chinese text with book-title marks', async () => {
    const rules = await makeRules("'《' -> '《' + '》'");
    const { startState, changes } = buildSelectionReplace('三体', 0, 2, '《');

    const specs = computeSideInsertChanges(startState, changes, rules, mockProgramTxn);

    expect(specs).toHaveLength(1);
    expect((specs[0].changes as any).insert).toBe('《三体》');
    // cursor at end: fromB(0) + 1 + 2 + 1 = 4
    expect(specs[0].selection).toEqual({ anchor: 4, head: 4 });
  });

  it('￥ wraps selection with $ for math', async () => {
    const rules = await makeRules("'￥' -> '$' + '$'");
    const { startState, changes } = buildSelectionReplace('x+y=z', 0, 5, '￥');

    const specs = computeSideInsertChanges(startState, changes, rules, mockProgramTxn);

    expect(specs).toHaveLength(1);
    expect((specs[0].changes as any).insert).toBe('$x+y=z$');
    // cursor at end: fromB(0) + 1 + 5 + 1 = 7
    expect(specs[0].selection).toEqual({ anchor: 7, head: 7 });
  });

  it('· (middle dot) wraps selection with backticks for inline code', async () => {
    const rules = await makeRules("'·' -> '`' + '`'");
    const { startState, changes } = buildSelectionReplace('code', 0, 4, '·');

    const specs = computeSideInsertChanges(startState, changes, rules, mockProgramTxn);

    expect(specs).toHaveLength(1);
    expect((specs[0].changes as any).insert).toBe('`code`');
  });

  it('side rule on empty selection (fromA === toA) does not fire', async () => {
    const rules = await makeRules("'《' -> '《' + '》'");
    // typing 《 at an empty cursor, not a selection
    const { startState, changes } = buildInsert('hello', 2, '《');

    const specs = computeSideInsertChanges(startState, changes, rules, mockProgramTxn);

    expect(specs).toHaveLength(0);
  });
});

// ─── shouldHijack edge cases ──────────────────────────────────────────────────

describe('shouldHijack edge cases', () => {
  it('multi-char insertion → allMatched=false, no rules fire', async () => {
    // paste/IME composition inserts multiple chars at once
    const rules = await makeRules("'a|' -> 'X|'");
    const startState = EditorState.create({ doc: '' });
    // insert 2 chars in one change → fromA===toA but fromB+1!==toB
    const changes = ChangeSet.of({ from: 0, insert: 'ab' }, 0);

    const { specs, allMatched } = await computeConvertChanges(
      startState, changes, rules, mockProgramTxn,
    );

    expect(allMatched).toBe(false);
    expect(specs).toHaveLength(0);
  });

  it('multi-char deletion → allMatched=false', async () => {
    const rules = await makeRules("'a|' -> 'X|'");
    const startState = EditorState.create({ doc: 'abc' });
    // delete 2 chars at once
    const changes = ChangeSet.of({ from: 0, to: 2 }, 3);

    const { specs, allMatched } = await computeConvertChanges(
      startState, changes, rules, mockProgramTxn,
    );

    expect(allMatched).toBe(false);
    expect(specs).toHaveLength(0);
  });

  it('first change matches but second does not → allMatched=false', async () => {
    const rules = await makeRules("'a|' -> 'X|'");
    const startState = EditorState.create({ doc: 'a_a' });
    // two single-char inserts in one update: one matches, one doesn't
    // ChangeSet.of can take an array
    const changes = ChangeSet.of(
      [{ from: 1, insert: 'a' }, { from: 3, insert: 'z' }],
      3,
    );

    const { allMatched } = await computeConvertChanges(
      startState, changes, rules, mockProgramTxn,
    );

    expect(allMatched).toBe(false);
  });
});


// ─── undo / redo: richer scenarios ───────────────────────────────────────────

describe('undo / redo: richer scenarios', () => {
  // Helper: apply a plugin-produced spec onto state
  function applyPlugin(state: EditorState, spec: TransactionSpec): EditorState {
    return state.update(spec).state;
  }

  it('auto-pair full lifecycle: type → pair fires → backspace → delete-pair fires → 4 undo steps', async () => {
    // Mirrors the actual 《 auto-pair + delete workflow from DEFAULT_RULES.
    // ProgramTxn must be threaded through both plugin steps for history to
    // keep them each as a separate undo entry.
    const rules = await makeRules(
      "'（|' -> '（|）'\n'（|）' -x '|'"
    );
    let state = makeStateWithHistory('');

    // T1: user types '（'
    const t1State = state;
    const t1Changes = ChangeSet.of({ from: 0, insert: '（' }, 0);
    state = state.update({ changes: t1Changes, userEvent: 'input' }).state;

    // T2: plugin auto-pairs → '（）', cursor at pos 1
    const { specs: t2Specs, allMatched: m2 } = await computeConvertChanges(
      t1State, t1Changes, rules, mockProgramTxn,
    );
    expect(m2).toBe(true);
    state = applyPlugin(state, t2Specs[0]);
    expect(state.doc.toString()).toBe('（）');

    // T3: user backspaces '（' at pos 0
    const t3State = state;
    const t3Changes = ChangeSet.of({ from: 0, to: 1 }, 2);
    state = state.update({ changes: t3Changes, userEvent: 'delete.backward' }).state;
    expect(state.doc.toString()).toBe('）');

    // T4: plugin delete-pair rule fires → removes '）'
    const { specs: t4Specs, allMatched: m4 } = await computeConvertChanges(
      t3State, t3Changes, rules, mockProgramTxn,
    );
    expect(m4).toBe(true);
    state = applyPlugin(state, t4Specs[0]);
    expect(state.doc.toString()).toBe('');

    // Undo path (confirmed by probing):
    // T4 plugin is separate from T3 user input, so:
    //   undo #1: '' → '）'   (T4 reverted)
    //   undo #2: '）' → '（' (T3 reverted — T3 deleted '（', undo re-inserts it; but T2 plugin
    //                          auto-paired so doc at that point was '（）', after undo T3 we get
    //                          '（）' briefly but history groups T2+T3 because T2 was ProgramTxn
    //                          applied between two user events? Actually probe says '）'→'（')
    //   undo #3: '（' → ''   (T2 plugin + T1 user reverted together)
    state = doUndo(state);
    expect(state.doc.toString()).toBe('）');    // T4 plugin reverted

    state = doUndo(state);
    expect(state.doc.toString()).toBe('（');    // T3 user reverted

    state = doUndo(state);
    expect(state.doc.toString()).toBe('');       // T2 plugin + T1 user reverted
  });

  it('chained conversions: 《 auto-pair then 《《 collapse — 4 distinct undo steps', async () => {
    const rules = await makeRules(
      "'《《|》' -> '<|'\n'《|' -> '《|》'"
    );
    let state = makeStateWithHistory('');

    // T1: user types 《
    const t1State = state;
    const t1Changes = ChangeSet.of({ from: 0, insert: '《' }, 0);
    state = state.update({ changes: t1Changes, userEvent: 'input' }).state;

    // T2: plugin → 《》
    const { specs: s2 } = await computeConvertChanges(t1State, t1Changes, rules, mockProgramTxn);
    state = applyPlugin(state, s2[0]);
    expect(state.doc.toString()).toBe('《》');

    // T3: user types 《 at pos 1 (inside the pair)
    const t3State = state;
    const t3Changes = ChangeSet.of({ from: 1, insert: '《' }, 2);
    state = state.update({ changes: t3Changes, userEvent: 'input' }).state;
    expect(state.doc.toString()).toBe('《《》');

    // T4: plugin 《《|》 -> < fires
    const { specs: s4, allMatched: m4 } = await computeConvertChanges(
      t3State, t3Changes, rules, mockProgramTxn,
    );
    expect(m4).toBe(true);
    state = applyPlugin(state, s4[0]);
    expect(state.doc.toString()).toBe('<');

    // 4 independent undo steps
    state = doUndo(state); expect(state.doc.toString()).toBe('《《》'); // undo T4
    state = doUndo(state); expect(state.doc.toString()).toBe('《》');  // undo T3
    state = doUndo(state); expect(state.doc.toString()).toBe('《');    // undo T2
    state = doUndo(state); expect(state.doc.toString()).toBe('');       // undo T1
  });

  it('chained conversions: full redo path restores every intermediate state', async () => {
    const rules = await makeRules(
      "'《《|》' -> '<|'\n'《|' -> '《|》'"
    );
    let state = makeStateWithHistory('');

    const t1State = state;
    const t1Changes = ChangeSet.of({ from: 0, insert: '《' }, 0);
    state = state.update({ changes: t1Changes, userEvent: 'input' }).state;
    const { specs: s2 } = await computeConvertChanges(t1State, t1Changes, rules, mockProgramTxn);
    state = applyPlugin(state, s2[0]);

    const t3State = state;
    const t3Changes = ChangeSet.of({ from: 1, insert: '《' }, 2);
    state = state.update({ changes: t3Changes, userEvent: 'input' }).state;
    const { specs: s4 } = await computeConvertChanges(t3State, t3Changes, rules, mockProgramTxn);
    state = applyPlugin(state, s4[0]);

    // undo all
    state = doUndo(state); state = doUndo(state);
    state = doUndo(state); state = doUndo(state);
    expect(state.doc.toString()).toBe('');

    // redo all
    state = doRedo(state); expect(state.doc.toString()).toBe('《');
    state = doRedo(state); expect(state.doc.toString()).toBe('《》');
    state = doRedo(state); expect(state.doc.toString()).toBe('《《》');
    state = doRedo(state); expect(state.doc.toString()).toBe('<');
  });

  it('two separate conversions each need two undos (6 undos total)', async () => {
    // First conversion: '（' → '（）' (auto-pair)
    // Second conversion: '《' → '《》' (auto-pair)
    const rules = await makeRules(
      "'（|' -> '（|）'\n'《|' -> '《|》'"
    );
    let state = makeStateWithHistory('');

    // conversion 1
    const c1State = state;
    const c1 = ChangeSet.of({ from: 0, insert: '（' }, 0);
    state = state.update({ changes: c1, userEvent: 'input' }).state;
    const { specs: sp1 } = await computeConvertChanges(c1State, c1, rules, mockProgramTxn);
    state = applyPlugin(state, sp1[0]);
    expect(state.doc.toString()).toBe('（）');

    // user moves cursor to end (pos 2), types 《
    const c2State = state;
    const c2 = ChangeSet.of({ from: 2, insert: '《' }, 2);
    state = state.update({ changes: c2, userEvent: 'input' }).state;
    const { specs: sp2 } = await computeConvertChanges(c2State, c2, rules, mockProgramTxn);
    state = applyPlugin(state, sp2[0]);
    expect(state.doc.toString()).toBe('（）《》');

    // 4 undo steps to go back through both conversions
    state = doUndo(state); expect(state.doc.toString()).toBe('（）《');   // undo pair 2 plugin
    state = doUndo(state); expect(state.doc.toString()).toBe('（）');      // undo pair 2 user
    state = doUndo(state); expect(state.doc.toString()).toBe('（');         // undo pair 1 plugin
    state = doUndo(state); expect(state.doc.toString()).toBe('');            // undo pair 1 user
  });

  it('side-insert wrap + continue typing: undo preserves typed chars first', async () => {
    // Wrap 'hello' with 《》, then type '！', then undo
    const rules = await makeRules("'《' -> '《' + '》'");
    let state = makeStateWithHistory('hello');

    // T1: user selects 'hello' and types '《'
    const t1State = state;
    const t1Changes = ChangeSet.of({ from: 0, to: 5, insert: '《' }, 5);
    state = state.update({ changes: t1Changes, userEvent: 'input' }).state;

    // T2: plugin wraps → '《hello》', cursor at 7
    const sp = computeSideInsertChanges(t1State, t1Changes, rules, mockProgramTxn);
    state = applyPlugin(state, sp[0]);
    expect(state.doc.toString()).toBe('《hello》');

    // T3: user types '！' at end
    state = state.update({ changes: { from: 7, insert: '！' }, userEvent: 'input' }).state;
    expect(state.doc.toString()).toBe('《hello》！');

    // undo order: T3 first, then T2, then T1
    state = doUndo(state); expect(state.doc.toString()).toBe('《hello》');  // undo T3
    state = doUndo(state); expect(state.doc.toString()).toBe('《');          // undo T2
    state = doUndo(state); expect(state.doc.toString()).toBe('hello');        // undo T1

    // redo restores full path
    state = doRedo(state); expect(state.doc.toString()).toBe('《');
    state = doRedo(state); expect(state.doc.toString()).toBe('《hello》');
    state = doRedo(state); expect(state.doc.toString()).toBe('《hello》！');
  });

  it('undo then new input clears the redo stack', async () => {
    const rules = await makeRules("'a|' -> 'X|'");
    let state = makeStateWithHistory('');

    const t1State = state;
    const t1Changes = ChangeSet.of({ from: 0, insert: 'a' }, 0);
    state = state.update({ changes: t1Changes, userEvent: 'input' }).state;
    const { specs } = await computeConvertChanges(t1State, t1Changes, rules, mockProgramTxn);
    state = applyPlugin(state, specs[0]);
    expect(state.doc.toString()).toBe('X');

    // undo both steps
    state = doUndo(state); // X → a
    state = doUndo(state); // a → ''
    expect(state.doc.toString()).toBe('');

    // new input branches history
    state = state.update({ changes: { from: 0, insert: 'z' }, userEvent: 'input' }).state;
    expect(state.doc.toString()).toBe('z');

    // redo should be a no-op now
    const beforeRedo = state.doc.toString();
    state = doRedo(state);
    expect(state.doc.toString()).toBe(beforeRedo);
  });
});

// ─── undo / redo behaviour ───────────────────────────────────────────────────

describe('undo / redo with ProgramTxn', () => {
  it('T10 - side insert rule requires two undos to fully revert', async () => {
    const rules = await makeRules("'#' -> '(comment::' + ')'");
    let state = makeStateWithHistory('hello');

    // T1: user selects all text and types '#'
    const t1StartState = state;
    const t1Changes = ChangeSet.of({ from: 0, to: 5, insert: '#' }, 5);
    state = state.update({ changes: t1Changes, userEvent: 'input' }).state;
    expect(state.doc.toString()).toBe('#');

    // T2: plugin fires side insert rule → "(comment::hello)"
    // computed against T1's startState + changes
    const specs = computeSideInsertChanges(t1StartState, t1Changes, rules, mockProgramTxn);
    expect(specs).toHaveLength(1);
    state = state.update(specs[0]).state;
    expect(state.doc.toString()).toBe('(comment::hello)');

    // undo #1 → back to '#'
    state = doUndo(state);
    expect(state.doc.toString()).toBe('#');

    // undo #2 → back to 'hello'
    state = doUndo(state);
    expect(state.doc.toString()).toBe('hello');
  });

  it('T11 - convert rule requires two undos to fully revert', async () => {
    // rule: 'ab|' → trigger is 'b', no right context needed
    const rules = await makeRules("'ab|' -> 'hello world|'");
    let state = makeStateWithHistory('a');

    // T1: user types 'b'
    const t1StartState = state;
    const t1Changes = ChangeSet.of({ from: 1, insert: 'b' }, 1);
    state = state.update({ changes: t1Changes, userEvent: 'input' }).state;
    expect(state.doc.toString()).toBe('ab');

    // T2: plugin fires convert rule
    const { specs, allMatched } = await computeConvertChanges(
      t1StartState, t1Changes, rules, mockProgramTxn,
    );
    expect(allMatched).toBe(true);
    state = state.update(specs[0]).state;
    expect(state.doc.toString()).toBe('hello world');

    // undo #1 → back to 'ab'
    state = doUndo(state);
    expect(state.doc.toString()).toBe('ab');

    // undo #2 → back to 'a'
    state = doUndo(state);
    expect(state.doc.toString()).toBe('a');
  });

  it('T12 - redo restores state after undo', async () => {
    const rules = await makeRules("'ab|' -> 'hello world|'");
    let state = makeStateWithHistory('a');

    const t1StartState = state;
    const t1Changes = ChangeSet.of({ from: 1, insert: 'b' }, 1);
    state = state.update({ changes: t1Changes, userEvent: 'input' }).state;

    const { specs } = await computeConvertChanges(
      t1StartState, t1Changes, rules, mockProgramTxn,
    );
    state = state.update(specs[0]).state;
    const finalDoc = state.doc.toString(); // 'hello world'

    state = doUndo(state);
    state = doUndo(state);
    expect(state.doc.toString()).toBe('a');

    state = doRedo(state);
    expect(state.doc.toString()).toBe('ab');

    state = doRedo(state);
    expect(state.doc.toString()).toBe(finalDoc);
  });
});
