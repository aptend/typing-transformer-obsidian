
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


export const PUNCTS = new Set<string>(" ，。：？,.:?");

export const DEFAULT_RULES = String.raw`
# Line head conversion
# Note: this rule can't apply to the very first line of the document
'\n》|' -> '\n>|'
'\n、|' -> '\n/|'

# CN symbols to EN
'。。|' -> '.|'
'》》|' -> '>|'
'、、|' -> '/|'
'；；|' -> ';|'
'，，|' -> ',|'

# Auto-pair, Input Conversion, and Deletion
'《《|》' -> '<|' # this one take higer priority than the next line
'《|'    -> '《|》'
'《|》'   -x '|'
'（（|）' -> '(|)'
'（|'     -> '（|）'
'（|）'   -x '|'

# Auto code block
'··|'  -> '\`|\`' # inline block
'\`·|\`' -> '\`\`\`|\n\`\`\`'

# have fun converting!
'dpx|' -> 'don\'t panic|'


# Selection Insert Rules
'·'  -> '\`' + '\`'
'￥'  -> '$' + '$'
'《'  -> '《' + '》'
'<'  -> '<' + '>'
`.replaceAll("\\`", "`");
