import { AnnotationType, ChangeSet, EditorState, TransactionSpec } from '@codemirror/state';
import { Rules, DEL_TRIG } from './ext_convert';

export async function computeConvertChanges(
    startState: EditorState,
    changes: ChangeSet,
    rules: Rules,
    programTxn: AnnotationType<boolean>,
): Promise<{ specs: TransactionSpec[]; allMatched: boolean }> {
    let shouldHijack = true;
    const changePromises: Promise<TransactionSpec | null>[] = [];
    const { insertTrigSet, deleteTrigSet, lmax, rmax } = rules;

    changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
        if (!shouldHijack) { return; }

        let trigger: string;
        if (fromA === toA && fromB + 1 === toB) { // insert one char
            // TODO: support emoji as the trigger
            trigger = inserted.sliceString(0);
            if (!insertTrigSet.has(trigger)) { shouldHijack = false; }
        } else if (fromA + 1 === toA && fromB === toB) { // delete one char
            // TODO: support emoji as the del trigger
            const delChar = startState.sliceDoc(fromA, toA);
            if (!deleteTrigSet.has(delChar)) { shouldHijack = false; }
            // mock inserting a special DEL_TRIG
            trigger = DEL_TRIG;
            // del: 578 579 578 578 -> insert: 579 579 579 580
            fromB += 1;
            toB = fromB + 1;
        } else {
            shouldHijack = false;
        }

        if (!shouldHijack) { return; }

        // extract the doc window around the insertion point
        let leftIdx = fromB - lmax;
        let insertPosFromInputTextHead = lmax;
        if (leftIdx < 0) {
            // at the very beginning of the document, we don't have enough chars required by lmax
            leftIdx = 0;
            insertPosFromInputTextHead = fromB;
        }
        const input = startState.sliceDoc(leftIdx, fromB + rmax);
        const promise = rules
            .match(input, trigger, insertPosFromInputTextHead)
            .then(rule => {
                if (rule != null) {
                    const change = rule.mapToChanges(fromB, trigger === DEL_TRIG);
                    change.annotations = programTxn.of(true);
                    return change;
                }
                return null;
            });
        changePromises.push(promise);
    });

    const results = await Promise.all(changePromises);
    const specs = results.filter((r): r is TransactionSpec => r !== null);
    const allMatched = shouldHijack && results.length === specs.length && specs.length > 0;
    return { specs, allMatched };
}

export function computeSideInsertChanges(
    startState: EditorState,
    changes: ChangeSet,
    rules: Rules,
    programTxn: AnnotationType<boolean>,
): TransactionSpec[] {
    let shouldHijack = true;
    const specs: TransactionSpec[] = [];

    changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
        const char = inserted.sliceString(0);
        if (!shouldHijack || fromA === toA || toB !== fromB + 1 || !rules.sideInsertMap.has(char)) {
            shouldHijack = false;
            return;
        }
        const rule = rules.sideInsertMap.get(char)!;
        const replaced = startState.sliceDoc(fromA, toA);
        const insertText = rule.left + replaced + rule.right;
        const cursorPos = rule.calculateCursorPos(fromB, replaced.length);
        specs.push({
            changes: { from: fromB, to: toB, insert: insertText },
            annotations: programTxn.of(true),
            selection: { anchor: cursorPos, head: cursorPos },
        });
    });

    return shouldHijack ? specs : [];
}
