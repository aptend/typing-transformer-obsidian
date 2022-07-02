
// full width
export namespace FW {
    export const DOT = "·";
    export const MONEY = "￥";
    export const FULLSTOP = "。";
    export const LT = "《";
    export const GT = "》";
    export const SLASH = "、";
    export const LEFTQUO = "“";
    export const RIGHTQUO = "”";
    export const LEFTPAREN = "（";
    export const RIGHTPAREN = "）";
}


// semi width
export namespace SW {
    export const DOT = "`";
    export const MONEY = "$";
    export const FULLSTOP = ".";
    export const LT = "<";
    export const GT = ">";
    export const SLASH = "/";
    export const LEFTQUO = '"';
    export const RIGHTQUO = '"';
    export const LEFTPAREN = "(";
    export const RIGHTPAREN = ")";
}

export const SIDES_INSERT_MAP = new Map<string, { l: string, r: string }>([
    [FW.DOT, { l: SW.DOT, r: SW.DOT }],
    [FW.MONEY, { l: SW.MONEY, r: SW.MONEY }],
    [FW.LEFTQUO, { l: FW.LEFTQUO, r: FW.RIGHTQUO }],
    [FW.RIGHTQUO, { l: FW.LEFTQUO, r: FW.RIGHTQUO }],
    [FW.LT, { l: FW.LT, r: FW.GT }],
    [SW.LT, { l: SW.LT, r: SW.GT }],
]);

export const PUNCTS = new Set<string>(" ，。：？,.:?");

export const DEFAULT_RULES = String.raw`# Rules
# line head, this rule can't apply to the very first line of the document
'\n》|' -> '\n>|'
'\n、|' -> '\n/|'

# Two2one
'。。|' -> '.|'
'》》|' -> '>|'
'、、|' -> '/|'
'；；|' -> ';|'
'，，|' -> ',|'

# auto pair and conver
'《《|》' -> '<|' # this one take higer priority
'《|'     -> '《|》'
'（（|）' -> '(|)'
'（|'     -> '（|）'

# auto block
'··|'  -> '\`|\`' # inline block
'\`·|\`' -> '\`\`\`|\n\`\`\`'

# have fun converting!
# 'hv1111|' -> 'have fun converting!|'
`.replaceAll("\\`", "`")
