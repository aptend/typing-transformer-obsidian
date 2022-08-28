import { TransactionSpec } from "@codemirror/state";

const EOF = "EOF";
const ANCHOR = "¦";
export const DEL_TRIG = "❌";

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

// return -1 if no anchar, return -2 if multiple anchors, otherwise return position of the anchor
function findOnlyAnchor(s: Array<string>): number {
    let res = -1, idx = 0;
    for (const ch of s) {
        if (ch === ANCHOR) {
            if (res == -1) {
                res = idx;
            } else {
                return -2;
            }
        }
        idx++;
    }
    return res;
}

function prefixOf(s1: Array<string>, s2: Array<string>): boolean {
    if (s1.length > s2.length) return false;
    for (let i = 0; i < s1.length; i++) {
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

enum ArrowType {
    Insert, // ->
    Delete, // -x
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
    innerTrig: string;
    left: Array<string>;
    right: Array<string>;
    lanchor: number;
    ranchor: number;
    replace: string;
    constructor(left: string, right: string, readonly isForDelete: boolean = false) {
        // Actually, a delete rule is treated like a spcial insert rule.
        // the trigger char is DEL_TRIG, which can be issued by program
        // e.g. '(|)' -x '|' will be translated into '(❌|)' -> '|'
        this.left = Array.from(left);
        this.right = Array.from(right);
        this.lanchor = findOnlyAnchor(this.left);
        this.ranchor = findOnlyAnchor(this.right);
        if (this.lanchor > 0 && isForDelete) {
            this.left.splice(this.lanchor, 0, DEL_TRIG);
            this.lanchor += 1;
        }
        this.innerTrig = this.left[this.lanchor - 1];

        this.replace = this.right.slice(0, this.ranchor).join('') + this.right.slice(this.ranchor + 1).join('');
    }

    get isValid(): boolean {
        return this.lanchor > 0 && this.ranchor >= 0;
    }

    invalidReasons(): string {
        const reasons = [];
        if (this.lanchor < 0) {
            reasons.push(`Expected one | on left side, but found ${this.lanchor == -1 ? "none" : "multiple"}`);
        } else if (this.lanchor === 0) {
            reasons.push("Invalid Placement of | on the left side. Note: left side cannot start with |");
        }
        if (this.ranchor < 0) {
            reasons.push(`Expected one | on right side, but found ${this.ranchor == -1 ? "none" : "multiple"}`);
        }
        return reasons.join("\n");
    }

    // trigChar is used to fill trigSet
    get trigChar(): string {
        if (this.isForDelete) {
            return this.left[this.lanchor - 2];
        } else {
            return this.left[this.lanchor - 1];
        }
    }

    canConvert(inputS: string, insChr: string, insPosBaseHead: number): boolean {
        const input = Array.from(inputS);
        if (!this.isValid || insChr != this.innerTrig) return false;

        const { left, lanchor } = this;

        // most rules match left part first, here we check again for good
        if (!suffixOf(left.slice(0, lanchor - 1), input.slice(0, insPosBaseHead))) return false;
        // left matched and then match right
        return prefixOf(left.slice(lanchor + 1), input.slice(insPosBaseHead));
    }

    leftMatchPart(): string[] {
        return this.left.slice(0, this.lanchor);
    }

    // pos is the position of trigger char in the whole documnet
    mapToChanges(pos: number): TransactionSpec {
        // as the trigger char not inserted into doc yet, the relative pos `lanchor - 1` is mapped to absolute postion `pos`
        // so the start of modification zone is pos + 1 - leftChars = pos + 1 - lanchor
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

const readable = JSON.stringify;

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
            return Err("Expected a rule starting with ', but found " + readable(this.peek()));
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
                case "\n":
                    return Err("Expected a rule ending with ', but found newline. Note: escape intentional newline with '\\n'");
                case EOF:
                    return Err("Expected a rule ending with ', but found nothing");
                default:
                    result.push(ch);
                    break;
            }
        }
    }

    private parseMapArrow(): ParseResult<ArrowType> {
        this.ignoreSpace();
        const first = this.eat(), second = this.eat();
        if (first === '-' && second === '>') {
            return Ok(ArrowType.Insert);
        } else if (first === '-' && second === 'x') {
            return Ok(ArrowType.Delete);
        }
        return Err(`Expected -> or -x, but found ${readable(first)}${readable(second)}`);
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
            return Err("Expected only one rule in each line, but found " + readable(ch));
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
            if (r2.value === ArrowType.Delete) {
                return Err("Expected ->, but found -x. Note: selection rules cannot be deletion rules");
            }
            const rightInsert = this.parseString();
            if (!rightInsert.isOk) { return Err(rightInsert.error); }
            const sideRule = new SideRule(r1.value, r3.value, rightInsert.value);
            if (!sideRule.isValid) {
                return Err("Expected one char, but found multiple. Note: the selection rule trigger char can only be a single character");
            }
            rule.type = RuleType.SideRule;
            rule.side = sideRule;
        } else {
            const convRule = new ConvRule(r1.value, r3.value, r2.value === ArrowType.Delete);
            if (!convRule.isValid) {
                return Err(convRule.invalidReasons());
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
                    for (const msg of rRes.error.split("\n")) {
                        this.errors.push(`line ${line}: ` + msg);
                    }
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
    index: TrieNode;
    errors: string[];
    insertTrigSet: Set<string>;
    deleteTrigSet: Set<string>;
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
        this.insertTrigSet = new Set<string>();
        this.deleteTrigSet = new Set<string>();
        this.lmax = this.rmax = 0;
        this.errors = parser.errors;
        if (this.errors.length > 0) return;

        this.rules = parser.convRules;
        this.index = newConvRulesIndex(this.rules);
        this.sideInsertMap = parser.sideRules;

        let lmax = 0, rmax = 0; // how many chars should be extracted from doc
        for (const r of this.rules) {
            if (r.isForDelete) {
                this.deleteTrigSet.add(r.trigChar);
            } else {
                this.insertTrigSet.add(r.trigChar);
            }
            const lmax_ = r.lanchor - 1, rmax_ = r.left.length - 1 - r.lanchor;
            if (lmax_ > lmax) lmax = lmax_;
            if (rmax_ > rmax) rmax = rmax_;
        }

        this.lmax = lmax;
        this.rmax = rmax;
    }

    // match a convert rule
    match(input: string, insChar: string, insPosBaseLineHead: number): ConvRule {
        const leftMatch = input.slice(0, insPosBaseLineHead);
        const candidates = this.index.collectIdxsAlong(leftMatch + insChar);

        // Are you insane? If compareFn omitted, 'the elements are sorted in ascending, ASCII character order' ????????
        // I am so small in face of Lord Javascript.
        for (const idx of candidates.sort((a, b) => a - b)) {
            if (this.rules[idx].canConvert(input, insChar, insPosBaseLineHead)) {
                return this.rules[idx];
            }
        }
        return null;
    }
}


function newConvRulesIndex(rules: ConvRule[]): TrieNode {
    const root = new TrieNode();
    for (let i = 0; i < rules.length; i++) {
        root.insert(rules[i], i);
    }
    return root;
}

// A reversed trie
class TrieNode {
    next: Map<string, TrieNode>;
    value: number[];

    constructor() {
        this.next = new Map();
        this.value = [];
    }

    isKeyStop(): boolean {
        return this.value.length > 0;
    }

    insert(rule: ConvRule, idx: number) {
        const key = rule.leftMatchPart();
        /* eslint-disable @typescript-eslint/no-this-alias */
        let node: TrieNode = this;

        for (let i = key.length - 1; i > -1; i--) {
            const ch = key[i];
            if (node.next.has(ch)) {
                node = node.next.get(ch);
            } else {
                const newNode = new TrieNode();
                node.next.set(ch, newNode);
                node = newNode;
            }
        }
        node.value.push(idx);
    }

    collectIdxsAlong(key: string): number[] {
        const idxs = [];

        let node: TrieNode = this;
        for (let i = key.length - 1; i > -1; i--) {
            if (node.isKeyStop()) { idxs.push(...node.value); }
            node = node.next.get(key[i]);
            if (node === undefined) { break; }
        }

        if (node != undefined && node.isKeyStop()) {
            idxs.push(...node.value);
        }

        return idxs;
    }
}
