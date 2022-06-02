
const FW_DOT = "·";
const FW_MONEY = "￥";
const FW_FULLSTOP = "。";
const FW_LT = "《";
const FW_GT = "》";
const FW_SLASH = "、";
const FW_LEFTQUO = "“";
const FW_RIGHTQUO = "”";
const FW_LEFTPAREN = "（";
const FW_RIGHTPAREN = "）";

const CONTIN_CHARS_SET = new Set<String>([FW_DOT, FW_MONEY, FW_FULLSTOP, FW_LT, FW_GT, FW_SLASH, FW_LEFTQUO, FW_LEFTPAREN, FW_RIGHTQUO, FW_RIGHTPAREN]);
const SIDES_INSERT_MAP = new Map<String, { l: string, r: string }>([
    [FW_DOT, { l: "`", r: "`" }],
    [FW_MONEY, { l: "$", r: "$" }],
    [FW_LEFTQUO, { l: FW_LEFTQUO, r: FW_RIGHTQUO }],
    [FW_RIGHTQUO, { l: FW_LEFTQUO, r: FW_RIGHTQUO }],
]);
