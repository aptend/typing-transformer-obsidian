import { TransactionSpec } from '@codemirror/state';
import {FW, SW} from './const';



// Mainly for pratice purpose
interface StateMachineRule {
    next(char: string): void;
    reset(): void;
    get hasResult(): boolean;
    resultSpecs(pos: number): TransactionSpec[];
}



export class RuleBatch {
    rules: StateMachineRule[]
    resultRule: StateMachineRule
    constructor(...rules: StateMachineRule[]) {
        this.rules = []
        this.rules.push(...rules)
    }

    reset() {
        this.rules.forEach((rule) => rule.reset())
    }
    next(char: string) {
        this.rules.forEach((rule) => rule.next(char))
    }

    get hasResult(): boolean {
        for (const rule of this.rules) {
            if (rule.hasResult) { this.resultRule = rule; return true }
        }
        return false
    }

    resultSpecs(pos: number): TransactionSpec[] {
        return this.resultRule?.resultSpecs(pos)
    }
}



const enum LineHeadState { Start, LineHead, Success, Fail }
const LineHeadMap = new Map<string, string>([[FW.GT, SW.GT], [FW.SLASH, SW.SLASH]])
export class LineHeadRule implements StateMachineRule {
    state: LineHeadState
    matched: string
    constructor() { this.reset() }
    reset() {
        this.state = LineHeadState.Start
        this.matched = ""
    }
    next(char: string) {
        switch (this.state) {
            case LineHeadState.Start:
                if (char === '' || char === '\n') {
                    this.state = LineHeadState.LineHead
                } else {
                    this.state = LineHeadState.Fail
                }
                break;
            case LineHeadState.LineHead:
                if (LineHeadMap.has(char)) {
                    this.state = LineHeadState.Success
                    this.matched = char
                } else {
                    this.state = LineHeadState.Start
                }
                break;
            case LineHeadState.Success:
            case LineHeadState.Fail:
                break;
        }
    }
    get hasResult(): boolean { return this.state == LineHeadState.Success }
    resultSpecs(pos: number): TransactionSpec[] {
        return [{
            changes: { from: pos, to: pos, insert: LineHeadMap.get(this.matched) },
            selection: { anchor: pos + 1, head: pos + 1 }
        }]
    }
}


// turn 2 continous full-width symbols into 1 semi-width symbol
const enum Two2OneState { Start, HaveOne, Success, Fail }
const Two2OneMap = new Map<string, string>([[FW.FULLSTOP, SW.FULLSTOP], [FW.GT, SW.GT], [FW.SLASH, SW.SLASH]])
export class Two2OneRule implements StateMachineRule {
    state: Two2OneState
    matched: string
    constructor() { this.reset() }
    reset() {
        this.state = Two2OneState.Start
        this.matched = ""
    }
    next(char: string) {
        switch (this.state) {
            case Two2OneState.Start:
                if (Two2OneMap.has(char)) {
                    this.state = Two2OneState.HaveOne
                    this.matched = char
                } else {
                    this.state = Two2OneState.Fail
                }
                break;
            case Two2OneState.HaveOne:
                if (char === this.matched) {
                    this.state = Two2OneState.Success
                } else {
                    this.state = Two2OneState.Start
                }
                break;
            case Two2OneState.Success:
            case Two2OneState.Fail:
                break;
        }
    }
    get hasResult(): boolean { return this.state == Two2OneState.Success }
    resultSpecs(pos: number): TransactionSpec[] {
        return [{ changes: { from: pos - 1, to: pos, insert: Two2OneMap.get(this.matched) } }]
    }
}


// auto pair for full-width symbols
const enum PairState { Start, PreparePair, PrepareConvertI, PrepareConvertII, ConfirmPair, ConfirmCovert, Fail }
const PairMap = new Map<string, { counterpart: string; covertto: string }>([
    [FW.LT, { counterpart: FW.GT, covertto: SW.LT }],
    [FW.LEFTPAREN, { counterpart: FW.RIGHTPAREN, covertto: SW.LEFTPAREN + SW.RIGHTPAREN }],
    [FW.LEFTQUO, { counterpart: FW.RIGHTQUO, covertto: SW.LEFTQUO + SW.RIGHTQUO }],
])
export class PairRule implements StateMachineRule {
    state: PairState
    matched: string
    constructor() { this.reset() }
    reset() {
        this.state = PairState.Start
        this.matched = ""
    }

    next(char: string) {
        switch (this.state) {
            case PairState.Start:
                if (PairMap.has(char)) {
                    this.state = PairState.PrepareConvertI
                    this.matched = char
                } else {
                    this.state = PairState.PreparePair
                }
                break;
            case PairState.PreparePair:
                if (PairMap.has(char)) {
                    this.state = PairState.ConfirmPair
                    this.matched = char
                } else {
                    this.state = PairState.Fail
                }
                break;
            case PairState.PrepareConvertI:
                if (char === this.matched) {
                    this.state = PairState.PrepareConvertII
                } else {
                    this.state = PairState.Fail
                }
                break;
            case PairState.PrepareConvertII:
                if (char === PairMap.get(this.matched).counterpart) {
                    this.state = PairState.ConfirmCovert
                } else {
                    this.state = PairState.Fail
                }
                break;
            case PairState.ConfirmCovert:
            case PairState.ConfirmPair:
            case PairState.Fail:
                break;
        }
    }

    get hasResult(): boolean { return this.state === PairState.ConfirmPair || this.state === PairState.ConfirmCovert }
    resultSpecs(pos: number): TransactionSpec[] {
        if (this.state === PairState.ConfirmCovert) {
            return [{
                changes: { from: pos - 1, to: pos + 1, insert: PairMap.get(this.matched).covertto },
                selection: { anchor: pos, head: pos }
            }]
        } else if (this.state === PairState.ConfirmPair) {
            return [{
                changes: { from: pos, to: pos, insert: this.matched + PairMap.get(this.matched).counterpart },
                selection: { anchor: pos + 1, head: pos + 1 }
            }]
        }
    }
}



// generate code block and math block
// this state is much like combining Two2One and Pair, is there a way to simplify it?
const enum BlockState { Start, PreparePair, PrepareBlockI, PrepareBlockII, ConfirmPair, ConfirmBlock, Fail }
const BlockMap = new Map<string, { counterpart: string; blockIns: string, blockSel: number }>([
    [FW.DOT, { counterpart: '`', blockIns: '``\n```', blockSel: 2 }],
    [FW.MONEY, { counterpart: '$', blockIns: '$\n$$', blockSel: 1 }],
])
const isBlockCounterpart = (char: string): boolean => {
    for (const item of BlockMap.values()) {
        if (item.counterpart == char) { return true }
    }
    return false
}
export class BlockRule implements StateMachineRule {
    state: BlockState
    matched: string
    constructor() { this.reset() }
    reset() {
        this.state = BlockState.Start
        this.matched = ""
    }

    next(char: string) {
        switch (this.state) {
            case BlockState.Start:
                if (BlockMap.has(char)) {
                    this.state = BlockState.PreparePair
                } else if (isBlockCounterpart(char)) {
                    this.state = BlockState.PrepareBlockI
                }
                this.matched = char
                break;
            case BlockState.PreparePair:
                if (char === this.matched) {
                    this.state = BlockState.ConfirmPair
                } else {
                    this.state = BlockState.Fail
                }
                break;
            case BlockState.PrepareBlockI:
                if (BlockMap.get(char)?.counterpart === this.matched) {
                    this.state = BlockState.PrepareBlockII
                    this.matched = char
                } else {
                    this.state = BlockState.Fail
                }
                break;
            case BlockState.PrepareBlockII:
                if (char === BlockMap.get(this.matched).counterpart) {
                    this.state = BlockState.ConfirmBlock
                } else {
                    this.state = BlockState.Fail
                }
                break;
            case BlockState.ConfirmPair:
            case BlockState.ConfirmBlock:
            case BlockState.Fail:
                break;
        }
    }

    get hasResult(): boolean { return this.state === BlockState.ConfirmBlock || this.state === BlockState.ConfirmPair }
    resultSpecs(pos: number): TransactionSpec[] {
        const info = BlockMap.get(this.matched)
        if (this.state === BlockState.ConfirmBlock) {
            const newPos = pos + info.blockSel
            return [{
                changes: { from: pos, to: pos + 1, insert: info.blockIns },
                selection: { anchor: newPos, head: newPos }
            }]
        } else if (this.state === BlockState.ConfirmPair) {
            return [{
                changes: { from: pos - 1, to: pos, insert: info.counterpart + info.counterpart },
                selection: { anchor: pos, head: pos }
            }]
        }
    }
}
