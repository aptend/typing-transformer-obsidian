
export module FW {
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
    export const CONTIN_CHARS_SET = new Set<String>([DOT, MONEY, FULLSTOP, LT, GT, SLASH, LEFTQUO, LEFTPAREN, RIGHTQUO, RIGHTPAREN]);
}


export module SW {
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
    export const CONTIN_CHARS_SET = new Set<String>([DOT, MONEY, FULLSTOP, LT, GT, SLASH, LEFTQUO, LEFTPAREN, RIGHTQUO, RIGHTPAREN]);
}
