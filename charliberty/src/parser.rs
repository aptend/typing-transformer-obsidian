use pest::Parser;
use std::ops::Range;

#[derive(pest_derive::Parser)]
#[grammar = "liberty.pest"]
struct LineParser;

#[derive(Debug, PartialEq, Eq)]
pub struct Plan {
    pub zone: Range<usize>,
    pub edits: Vec<Range<usize>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Kind {
    Han,
    Latin,
    Number,
    Punct,
    FullWidthPunct,
    Emphasis,
    Literal,
    OpenCode,
    Other,
}

struct Token {
    kind: Kind,
    bytes: Range<usize>,
}

fn tokens(text: &str, base: usize) -> Option<Vec<Token>> {
    use Kind::*;
    let line = LineParser::parse(Rule::Line, text).ok()?.next()?;
    Some(
        line.into_inner()
            .filter_map(|pair| {
                let kind = match pair.as_rule() {
                    Rule::Cn => Han,
                    Rule::Eng | Rule::Identifier => Latin,
                    Rule::Num => Number,
                    Rule::Punct => Punct,
                    Rule::FWPunct => FullWidthPunct,
                    Rule::InlineEm => Emphasis,
                    Rule::InlineCode
                    | Rule::InlineMath
                    | Rule::DocLink
                    | Rule::MarkdownLink
                    | Rule::URL
                    | Rule::Time
                    | Rule::Meridiem => Literal,
                    Rule::OpenCode => OpenCode,
                    Rule::Other => Other,
                    _ => return None,
                };
                let span = pair.as_span();
                Some(Token {
                    kind,
                    bytes: base + span.start()..base + span.end(),
                })
            })
            .collect(),
    )
}

fn spacing_edits(text: &str, tokens: &[Token], zone: &Range<usize>) -> Vec<Range<usize>> {
    use Kind::*;
    tokens
        .windows(2)
        .filter_map(|pair| {
            let [left, right] = [&pair[0], &pair[1]];
            if left.bytes.start < zone.start || right.bytes.end > zone.end {
                return None;
            }
            let gap = left.bytes.end..right.bytes.start;
            let existing = &text[gap.clone()];
            match (left.kind, right.kind, existing) {
                // Keep intentional runs of whitespace, tabs, and literal content.
                (OpenCode, _, _) | (_, OpenCode, _) => None,
                (FullWidthPunct, _, " ") | (_, Punct | FullWidthPunct, " ") => Some(gap),
                (Punct, Han | Latin | Number | Emphasis | Literal, "")
                | (Han, Latin | Number, "")
                | (Latin | Number, Han, "")
                // Preserve the existing spacing around recognized inline markup and literals.
                | (Emphasis | Literal, Han | Latin | Number | Emphasis | Literal, "")
                | (Han | Latin | Number, Emphasis | Literal, "") => Some(gap),
                _ => None,
            }
        })
        .collect()
}

fn is_sentence_mark(c: char) -> bool {
    "，。：？,.:?".contains(c)
}

// Pest works in UTF-8 bytes; the editor uses UTF-16 code units. Keep a reusable
// map so adjacent tokens may share the same boundary without consuming it.
struct Offsets(Vec<(usize, usize)>);

impl Offsets {
    fn new(text: &str) -> Self {
        let mut utf16 = 0;
        let mut offsets: Vec<_> = text
            .char_indices()
            .map(|(byte, c)| {
                let pos = (byte, utf16);
                utf16 += c.len_utf16();
                pos
            })
            .collect();
        offsets.push((text.len(), utf16));
        Self(offsets)
    }

    fn byte_at(&self, utf16: usize) -> Option<usize> {
        let index = self.0.binary_search_by_key(&utf16, |pos| pos.1).ok()?;
        Some(self.0[index].0)
    }

    fn utf16_at(&self, byte: usize) -> usize {
        // Every range in the plan originates from a Pest span or char boundary.
        let index = self.0.binary_search_by_key(&byte, |pos| pos.0).unwrap();
        self.0[index].1
    }

    fn range(&self, bytes: Range<usize>) -> Range<usize> {
        self.utf16_at(bytes.start)..self.utf16_at(bytes.end)
    }
}

fn plan_zone(
    text: &str,
    tokens: &[Token],
    cursor: usize,
    last: usize,
    base: usize,
) -> Option<Plan> {
    use Kind::*;
    let trigger = text[last..cursor].chars().next()?;
    let is_trigger = trigger == ' ' || is_sentence_mark(trigger);
    // The caret is inside (start, end). The trigger itself can still belong
    // to a literal when the caret is at its end (for example, a URL's comma).
    if let Some(token) = tokens.iter().rfind(|token| token.bytes.start < cursor) {
        if (token.kind == OpenCode && token.bytes.contains(&last))
            || (matches!(token.kind, Literal | Number)
                && (cursor < token.bytes.end || (is_trigger && token.bytes.contains(&last))))
        {
            return None;
        }
        if token.kind == Emphasis && cursor < token.bytes.end {
            let bytes = token.bytes.clone();
            let mark = text[bytes.clone()]
                .bytes()
                .take_while(|b| *b == text.as_bytes()[bytes.start])
                .count();
            let body = bytes.start + mark..bytes.end - mark;
            if !(body.start < cursor && cursor <= body.end) {
                return None;
            }
            // Analyze the complete emphasis body so a code span can close
            // to the right of the caret and still protect its contents.
            let inner = self::tokens(&text[body.clone()], body.start)?;
            return plan_zone(text, &inner, cursor, last, body.start);
        }
    }

    let start = tokens
        .iter()
        .rfind(|token| {
            token.bytes.start < last
                && matches!(token.kind, Punct | FullWidthPunct)
                && text[token.bytes.clone()]
                    .chars()
                    .next()
                    .is_some_and(is_sentence_mark)
        })
        .map_or(base, |token| token.bytes.start);
    let zone = start..cursor;
    let edits = if is_trigger {
        spacing_edits(text, tokens, &zone)
    } else {
        Vec::new()
    };
    Some(Plan { zone, edits })
}

pub fn plan_line(text: &str, cursor_utf16: usize) -> Option<Plan> {
    let offsets = Offsets::new(text);
    let cursor = offsets.byte_at(cursor_utf16)?;
    let (last, _) = text[..cursor].char_indices().next_back()?;
    let plan = plan_zone(text, &tokens(text, 0)?, cursor, last, 0)?;
    Some(Plan {
        zone: offsets.range(plan.zone),
        edits: plan
            .edits
            .into_iter()
            .map(|gap| offsets.range(gap))
            .collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn render_whole_line(text: &str) -> String {
        let mut result = text.to_owned();
        for edit in spacing_edits(text, &tokens(text, 0).unwrap(), &(0..text.len()))
            .into_iter()
            .rev()
        {
            let replacement = if edit.is_empty() { " " } else { "" };
            result.replace_range(edit, replacement);
        }
        result
    }

    #[test]
    fn spacing_uses_explicit_pairs_and_keeps_existing_punctuation_and_markup() {
        for (raw, expected) in [
            ("", ""),
            ("测试A4纸。", "测试 A4 纸。"),
            ("版本v2.1.3发布。", "版本 v2.1.3 发布。"),
            ("尺寸100px，浓度1.2e-3mol。", "尺寸 100px，浓度 1.2e-3mol。"),
            ("中文http2测试。", "中文 http2 测试。"),
            ("函数p_cache和q_cache。", "函数 p_cache 和 q_cache。"),
            (
                "调用_private_cache2和cache_。",
                "调用 _private_cache2和cache_。",
            ),
            ("调用_private_cache2。", "调用 _private_cache2。"),
            ("调用cache_测试。", "调用 cache_ 测试。"),
            ("缓存_p_cache_。", "缓存 _p_cache_。"),
            ("𠮷API。", "𠮷 API。"),
            (
                "秦时moon汉时关，  万里长征人no还",
                "秦时 moon 汉时关，  万里长征人 no 还",
            ),
            (
                "秦时 moon汉时关， 万里长征人no 还",
                "秦时 moon 汉时关，万里长征人 no 还",
            ),
            (
                "他人笑我太疯癫,我笑他人不够high",
                "他人笑我太疯癫, 我笑他人不够 high",
            ),
            (
                "do you know how much i like life?i had never killed myself",
                "do you know how much i like life? i had never killed myself",
            ),
            (
                "秦时moon 汉时`关，  万里`长征人 no 还",
                "秦时 moon 汉时 `关，  万里` 长征人 no 还",
            ),
            (
                "秦时 moon汉时关，  万里$长\\$征$人no 还",
                "秦时 moon 汉时关，  万里 $长\\$征$ 人 no 还",
            ),
            (
                "**秦**时moon汉时关，万里___长*_*征___ 人no 还",
                "**秦** 时 moon 汉时关，万里 ___长*_*征___ 人 no 还",
            ),
            (
                "**秦时**moon汉时关， _万里_**长**征人no 还",
                "**秦时** moon 汉时关，_万里_ **长** 征人 no 还",
            ),
            (
                "秦-时moon 汉时%关 ，  万里`长征人no 还",
                "秦-时 moon 汉时%关，  万里`长征人no 还",
            ),
            ("1 + 1 is a hard problem", "1 + 1 is a hard problem"),
            ("1+1 is a hard problem", "1+1 is a hard problem"),
            (" 中文  API\t测试。  ", " 中文  API\t测试。  "),
        ] {
            assert_eq!(render_whole_line(raw), expected, "{raw:?}");
            assert_eq!(render_whole_line(expected), expected, "{expected:?}");
        }
    }

    #[test]
    fn reports_only_space_edits_in_original_utf16_coordinates() {
        let input = "😀 测试A4纸 。尾部API";
        let plan = plan_line(input, "😀 测试A4纸 。".encode_utf16().count()).unwrap();
        assert_eq!(plan.zone, 0..10);
        assert_eq!(plan.edits, vec![5..5, 7..7, 8..9]);
        assert!(plan_line(input, 1).is_none(), "inside a surrogate pair");
        assert!(plan_line(input, 100).is_none(), "past end of line");
    }

    #[test]
    fn caret_and_sentence_boundaries_respect_literals() {
        for (before, after) in [
            ("😀`中文ABC,", "`后面"),
            ("1`中文ABC,", "`后面"),
            ("😀``中文`ABC,", "`` 后面"),
            ("``中文ABC,", ""),
            ("😀**`中文ABC,", "`**"),
            ("$中文API,", "$"),
            ("[[中文ABC,", "]]"),
            ("[中文ABC,", "](https://example.com/a(b))"),
            ("中文https://example.com/foo?", ""),
            ("时间08:", "30。"),
            ("版本v2.", "1发布。"),
        ] {
            assert_eq!(
                plan_line(&format!("{before}{after}"), before.encode_utf16().count()),
                None,
                "{before}|{after}"
            );
        }
        let text = "旧段API，版本v2.1.3发布。后段API";
        let end = "旧段API，版本v2.1.3发布。".encode_utf16().count();
        let plan = plan_line(text, end).unwrap();
        assert_eq!(plan.zone, 5..end);
        assert_eq!(plan.edits, vec![8..8, 14..14]);
    }

    #[test]
    fn retains_emphasis_spacing_and_formats_body_without_crossing_delimiters() {
        let outside = "这是**API**文档。";
        let plan = plan_line(outside, outside.encode_utf16().count()).unwrap();
        assert_eq!(plan.edits, vec![2..2, 9..9]);
        let before = "这是**中文API，";
        let plan = plan_line(&format!("{before}**文档。"), before.encode_utf16().count()).unwrap();
        assert_eq!(plan.zone, 4..10);
        assert_eq!(plan.edits, vec![6..6]);
    }
}
