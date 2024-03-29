use anyhow::Result;
use pest::Parser;

#[derive(Parser)]
#[grammar = "liberty.pest"]
pub struct LineParser;

pub fn insert_liberty(line: &str) -> Result<String> {
    insert_liberty_inner(line, false)
}

// block_ranges gives the spans of SpecialBlocks and spans of InlineEm
pub fn block_ranges(line: &str, cursor_pos: usize) -> (Vec<usize>, Vec<usize>) {
    let total = line.chars().count();
    let cursor_offset = line
        .char_indices()
        .nth(cursor_pos)
        .map(|(idx, _)| idx)
        .unwrap_or(line.len());

    let mut chars = line.char_indices().enumerate();

    let mut map_to_char_idx = |u8_offset: usize| -> usize {
        for (nth, (idx, _)) in chars.by_ref() {
            if idx == u8_offset {
                return nth;
            }
            if idx > u8_offset {
                break;
            }
        }
        total
    };

    let mut special_spans = vec![];
    let mut em_spans = vec![];
    if let Ok(pairs) = LineParser::parse(Rule::Line, line) {
        let blocks = pairs.into_iter().next().unwrap().into_inner();
        for block in blocks {
            let span = block.as_span();
            if cursor_offset <= span.start() {
                break;
            }
            if block.as_rule() == Rule::SpecialBlock {
                special_spans.push(map_to_char_idx(span.start()));
                special_spans.push(map_to_char_idx(span.end()) - 1);
            } else if block.as_rule() == Rule::InlineEm {
                em_spans.push(map_to_char_idx(span.start()));
                em_spans.push(map_to_char_idx(span.end()) - 1);
            }
        }
    }
    (special_spans, em_spans)
}

fn insert_liberty_inner(line: &str, debug: bool) -> Result<String> {
    let mut result = String::with_capacity(line.len() * 2);

    let pairs = LineParser::parse(Rule::Line, line)?;
    let line_rule = pairs.into_iter().next().unwrap();
    debug_assert_eq!(Rule::Line, line_rule.as_rule());

    let blocks = line_rule.into_inner();

    let first = blocks.peek().unwrap();
    let mut prev_block_kind = first.as_rule();
    let mut prev_block_end_pos = first.as_span().end();
    result.push_str(first.as_str());

    if debug {
        println!("-- {:?}", first);
    }

    for block in blocks.into_iter().skip(1) {
        if debug {
            println!("-- {:?}", block);
        }

        match (prev_block_kind, block.as_rule()) {
            (_, Rule::EOI) => break,
            // keep MultiSpace
            (_, Rule::MultiSpace) | (Rule::MultiSpace, _)
            // no space around FullWidth punct 
            | (_, Rule::FWPunct) | (Rule::FWPunct, _)
            // no space before punct
            | (_, Rule::Punct)
             => result.push_str(block.as_str()),
            // keep other and its surrounding space intact
            | (_, Rule::Other) | (Rule::Other, _)
             => {
                // a single space is default ignored, check add it back
                // stay in awe of the UNKNOWN
                if block.as_span().start() == prev_block_end_pos + 1 {
                    result.push(' ')
                }
                result.push_str(block.as_str());
            }
            (_, _) => {
                // default add space
                result.push(' ');
                result.push_str(block.as_str())
            },
        }
        prev_block_kind = block.as_rule();
        prev_block_end_pos = block.as_span().end();
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use crate::parser::*;
    use std::ops::Range;
    #[test]
    fn test_is_in_block() {
        let text = "起点 `终` at `12` a.m. ignore `another block`";
        assert_eq!(block_ranges(text, 3).0, []);
        assert_eq!(block_ranges(text, 4).0, [3, 5]); // before 终
        assert_eq!(block_ranges(text, 11).0, [3, 5, 10, 13]); // before 12
        assert_eq!(block_ranges(text, 100).0, [3, 5, 10, 13, 15, 17, 27, 41]); // show all special blocks
        assert_eq!(
            block_ranges("`新的曙光.mz` 我的朋友`觉.z`", 20).0,
            [0, 8, 14, 18]
        );

        let text = "起点 **`终` at `12`** a.m. ignore `another block`";
        assert_eq!(block_ranges(text, 3), (vec![], vec![]));
        assert_eq!(block_ranges(text, 4), (vec![], vec![3, 17]));
        assert_eq!(block_ranges(text, 5), (vec![], vec![3, 17]));
        assert_eq!(block_ranges(text, 6), (vec![], vec![3, 17])); // before 终
        assert_eq!(block_ranges(text, 13), (vec![], vec![3, 17])); // before 12
        assert_eq!(block_ranges(text, 100), (vec![19, 21, 31, 45], vec![3, 17]));
        // show all
    }

    #[derive(Default)]
    struct Tester<'a> {
        name: &'a str,
        cases: Vec<(&'a str, &'a str)>,
        picked_range: Option<Range<usize>>,
    }

    impl<'a> Tester<'a> {
        fn new() -> Self {
            Tester::default()
        }

        fn name(&mut self, s: &'a str) -> &mut Self {
            self.name = s;
            self
        }

        fn cases(&mut self, cases: Vec<(&'a str, &'a str)>) -> &mut Self {
            self.cases = cases;
            self
        }

        #[allow(unused)]
        // pick is 1-based offset
        fn pick_one_for_debug(&mut self, pick: usize) -> &mut Self {
            if pick > self.cases.len() || pick < 1 {
                panic!("pick out of range")
            }
            self.picked_range = Some(pick - 1..pick);
            self
        }

        fn test(&self) {
            if let Some(range) = &self.picked_range {
                self.test_range(range.clone(), true)
            } else {
                self.test_range(0..self.cases.len(), false)
            }
        }

        fn test_range(&self, range: Range<usize>, debug: bool) {
            let start = range.start;
            for (i, (case, want)) in self.cases[range].iter().enumerate() {
                let got = insert_liberty_inner(case, debug).unwrap();
                assert_eq!(
                    &got.as_str(),
                    want,
                    "\nbad case is Group {:?} number {} case, left is got, right is want \n",
                    self.name,
                    i + 1 + start
                );
            }
        }
    }

    #[test]
    fn test_basic_eng_cn() {
        Tester::new()
            .name("eng_cn")
            .cases(vec![
                ("", ""),
                (
                    "秦时moon汉时关，  万里长征人no还",
                    "秦时 moon 汉时关，  万里长征人 no 还",
                ),
                (
                    "秦时 moon 汉时关，   万里长征人 no 还",
                    "秦时 moon 汉时关，   万里长征人 no 还",
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
            ])
            .test();
    }
    #[test]
    fn test_basic_inline_block() {
        Tester::new()
            .name("inline block")
            .cases(vec![
                (
                    "```秦时`moon汉《时》关， 万里长征人$no$还",
                    "`` `秦时` moon 汉《时》关，万里长征人 $no$ 还",
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
            ])
            .test();
    }

    #[test]
    fn test_basic_other() {
        Tester::new()
            .name("other block")
            .cases(vec![
                (
                    "**秦时**moon汉时关， _万里_**长**征人no 还",
                    "**秦时** moon 汉时关，_万里_ **长** 征人 no 还",
                ),
                (
                    "秦-时moon 汉时%关 ，  万里`长征人no 还",
                    "秦-时 moon 汉时%关，  万里`长征人 no 还",
                ),
                (
                    "1 + 1 is a hard problem",
                    "1 + 1 is a hard problem",
                ),
                (
                    "1+1 is a hard problem",
                    "1+1 is a hard problem",
                )

            ])
            .test();
    }
}
