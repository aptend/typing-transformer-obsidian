import { TransactionSpec } from "@codemirror/state";

const EOF = "EOF";
const ANCHOR = "¦";


class ParseResult<T> {
    constructor(readonly value: T, readonly error: string) { }

    get isOk(): boolean {
        return this.error == "";
    }
}

function Ok<T>(val: T): ParseResult<T> {
    return new ParseResult(val, "");
}

function Err<T>(err: string): ParseResult<T> {
    return new ParseResult(null, err);
}


function findOnlyAnchor(s: Array<string>): number {
    let res = -1, idx = 0;
    for (const ch of s) {
        if (ch === ANCHOR) {
            if (res == -1) {
                res = idx;
            } else {
                return -1;
            }
        }
        idx++;
    }
    return res;
}

function prefixOf(s1: Array<string>, s2: Array<string>): boolean {
    if (s1.length > s2.length) return false;
    for (let i = 1; i < s1.length; i++) {
        if (s1[i] != s2[i]) return false;
    }
    return true;
}

function suffixOf(s1: Array<string>, s2: Array<string>): boolean {
    if (s1.length > s2.length) return false;
    for (let i = s1.length - 1, j = s2.length - 1; i > -1; i--, j--) {
        if (s1[i] != s2[j]) return false;
    }
    return true;
}


enum RuleType {
    ConvRule,
    SideRule,
}

class Rule {
    type: RuleType;
    conv: ConvRule;
    side: SideRule;
}

class SideRule {
    constructor(readonly trig: string, readonly left: string, readonly right: string) { }
    get isValid(): boolean {
        return this.trig.length === 1;
    }
}

class ConvRule {
    trig: string;
    left: Array<string>;
    right: Array<string>;
    lanchor: number;
    ranchor: number;
    replace: string;
    constructor(left: string, right: string) {
        this.left = Array.from(left);
        this.right = Array.from(right);
        this.lanchor = findOnlyAnchor(this.left);
        this.ranchor = findOnlyAnchor(this.right);
        this.trig = this.left[this.lanchor - 1];
        this.replace = this.right.slice(0, this.ranchor).join('') + this.right.slice(this.ranchor + 1).join('');
    }

    get isValid(): boolean {
        return this.lanchor > 0 && this.ranchor > 0;
    }

    canConvert(inputS: string, insChr: string, insPosBaseHead: number): boolean {
        const input = Array.from(inputS);
        if (!this.isValid || insChr != this.trig) return false;

        const { left, lanchor } = this;

        // most rules match left part first
        if (!suffixOf(left.slice(0, lanchor - 1), input.slice(0, insPosBaseHead))) return false;
        // left matched and then match right
        return prefixOf(left.slice(lanchor + 1), input.slice(insPosBaseHead));
    }

    // pos is the position of trigger char in the whole documnet
    mapToChanges(pos: number): TransactionSpec {
        // as the trigger char not inserted into doc yet, the relative pos `lanchor - 1` is mapped to absolute postion `pos`
        // so the start of modification zone is pos + 1 - lleftChars = pos + 1 - lanchor
        // and the end is start + leftLength - 2(which are trig + ANCHOR)

        const { left, lanchor, ranchor } = this;
        const from = pos + 1 - lanchor;
        const to = from + left.length - 2;
        const newPos = pos + (ranchor - lanchor + 1);

        return {
            changes: { from: from, to: to, insert: this.replace },
            selection: { anchor: newPos, head: newPos }
        };
    }
}


class RuleParser {
    input: string[];
    idx: number;
    convRules: ConvRule[];
    sideRules: Map<string, { l: string, r: string }>;
    errors: string[];
    constructor(input: string) {
        this.idx = 0;
        this.input = Array.from(input);
        this.convRules = [];
        this.sideRules = new Map();
        this.errors = [];
    }


    private peek(): string {
        const { idx, input } = this;
        if (idx == input.length) {
            return EOF;
        }
        return input[idx];
    }

    private eat(): string {
        const { idx, input } = this;
        if (idx == input.length) {
            return EOF;
        }
        return input[this.idx++];
    }

    private rewind() { this.idx--; }

    private ignoreSpace() {
        while (this.peek() === ' ') { this.eat(); }
    }

    private parseString(): ParseResult<string> {
        this.ignoreSpace();
        if (this.peek() != "'") {
            return Err("expect a rule string starting with ', found " + this.peek());
        }
        this.eat();
        const result: string[] = [];
        let ch: string;
        while (true) {
            ch = this.eat();
            switch (ch) {
                case '\\':
                    switch (this.peek()) {
                        case "'":
                            result.push(this.eat());
                            break;
                        case "n":
                            this.eat();
                            result.push('\n');
                            break;
                        default:
                            result.push(ch);
                            break;
                    }
                    break;
                case "'":
                    // parse succ
                    return Ok(result.join(''));
                case EOF:
                    return Err("expect a rule string, found EOF");
                default:
                    result.push(ch);
                    break;
            }
        }
    }

    private parseMapArrow(): ParseResult<string> {
        this.ignoreSpace();
        const first = this.eat(), second = this.eat();
        if (first != '-' || second != '>') {
            return Err(`expect ->, found ${first}${second}`);
        }
        return Ok('->');
    }

    private parseComment(): ParseResult<string> {
        this.ignoreSpace();
        let ch = this.peek();
        if (ch === '#') {
            while (ch != '\n' && ch != EOF) {
                ch = this.eat();
            }
            if (ch === '\n') {
                this.rewind(); // leave newline for parse to count
            }
        }
        if (ch != '\n' && ch != EOF) {
            return Err("Expect one rule ending with newline or EOF, found " + ch);
        }
        return Ok("#no content#");
    }

    // a side insert rule is like 'x' -> 'xx' + 'yy'
    // isSideRule check if a '+' exists
    private isSideRule(): boolean {
        this.ignoreSpace();
        const ch = this.peek();
        if (ch != '+') {
            return false;
        } else {
            this.eat();
            return true;
        }
    }

    parseOne(): ParseResult<Rule> {
        const r1 = this.parseString();
        if (!r1.isOk) { return Err(r1.error); }
        const r2 = this.parseMapArrow();
        if (!r2.isOk) { return Err(r2.error); }
        const r3 = this.parseString();
        if (!r3.isOk) { return Err(r3.error); }

        const rule = new Rule();
        if (this.isSideRule()) {
            const rightInsert = this.parseString();
            if (!rightInsert.isOk) { return Err(rightInsert.error); }
            const sideRule = new SideRule(r1.value, r3.value, rightInsert.value);
            if (!sideRule.isValid) {
                return Err("the trigger of a side insert rule should be a single char");
            }
            rule.type = RuleType.SideRule;
            rule.side = sideRule;
        } else {
            const convRule = new ConvRule(r1.value, r3.value);
            if (!convRule.isValid) {
                return Err("rule shuold has one and only one non-heading |");
            }
            rule.type = RuleType.ConvRule;
            rule.conv = convRule;
        }

        const r4 = this.parseComment();
        if (!r4.isOk) { return Err(r4.error); }

        return Ok(rule);
    }

    parse() {
        let line = 1;
        while (true) {
            const r = this.parseComment();
            if (!r.isOk) {
                // this line has something, go parsing
                const rRes = this.parseOne();
                if (!rRes.isOk) {
                    this.errors.push(`error: line ${line}: ` + rRes.error);
                } else if (rRes.value.type === RuleType.ConvRule) {
                    this.convRules.push(rRes.value.conv);
                } else {
                    const s = rRes.value.side;
                    this.sideRules.set(s.trig, { l: s.left, r: s.right });
                }
            }

            const ch = this.eat();
            if (ch === '\n') {
                line++;
            } else {
                // EOF or a unexpected char
                break;
            }
        }
    }
}


export class Rules {
    // fetch side insert rules directly from this map
    sideInsertMap: Map<string, { l: string, r: string }>;
    rules: ConvRule[];
    errors: string[];
    trigSet: Set<string>;
    lmax: number;
    rmax: number;
    constructor(ruletxt: string) {
        // TODO: handle escape in parser?
        const unescapedTxt = ruletxt
            .replaceAll("\\|", "{0v0}") // to a placeholder
            .replaceAll("|", ANCHOR)
            .replaceAll("{0v0}", "|"); // and convert it back
        const parser = new RuleParser(unescapedTxt);
        parser.parse();
        this.rules = [];
        this.trigSet = new Set<string>();
        this.lmax = this.rmax = 0;
        this.errors = parser.errors;
        if (this.errors.length > 0) return;

        this.rules = parser.convRules;
        this.sideInsertMap = parser.sideRules;

        let lmax = 0, rmax = 0; // how many chars should be extracted from doc
        for (const r of this.rules) {
            this.trigSet.add(r.trig);
            const lmax_ = r.lanchor - 1, rmax_ = r.left.length - 1 - r.lanchor;
            if (lmax_ > lmax) lmax = lmax_;
            if (rmax_ > rmax) rmax = rmax_;
        }

        this.lmax = lmax;
        this.rmax = rmax;
    }

    // match a convert rule
    match(input: string, insChar: string, insPosBaseLineHead: number): ConvRule {
        for (const rule of this.rules) {
            if (rule.canConvert(input, insChar, insPosBaseLineHead)) {
                return rule;
            }
        }
        return null;
    }

    // TODO: Add index for rules, some thoughts:
    // 1. sort by left match string. Note: higher priority problem
    // 2. pick chars by stride to calc hash to find
}
