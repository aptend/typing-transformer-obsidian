import { TransactionSpec } from '@codemirror/state';
import './const';



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
        for (let rule of this.rules) {
            if (rule.hasResult) { this.resultRule = rule; return true }
        }
        return false
    }

    resultSpecs(pos: number): TransactionSpec[] {
        return this.resultRule?.resultSpecs(pos)
    }
}



const enum LineHeadState { Start, LineHead, Success, Fail }
const LineHeadMap = new Map<string, string>([[FW_GT, '>'], [FW_SLASH, '/']])
export class LineHeadRule {
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



const enum Two2OneState { Start, HaveOne, Success, Fail }
const Two2OneMap = new Map<string, string>([[FW_FULLSTOP, '.'], [FW_GT, '>'], [FW_SLASH, '/']])
export class Two2OneRule {
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



const enum PairState { Start, PreparePair, PrepareConvertI, PrepareConvertII, ConfirmPair, ConfirmCovert, Fail }
const PairMap = new Map<string, { counterpart: string; covertto: string }>([
    [FW_LT, { counterpart: FW_GT, covertto: '<' }],
    [FW_LEFTPAREN, { counterpart: FW_RIGHTPAREN, covertto: '()' }],
    [FW_LEFTQUO, { counterpart: FW_RIGHTQUO, covertto: '""' }],
])
export class PairRule {
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
