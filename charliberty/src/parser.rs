use anyhow::Result;
use pest::Parser;

#[derive(Parser)]
#[grammar = "liberty.pest"]
pub struct LineParser;

pub fn insert_liberty(line: &str) -> Result<String> {
    let mut result = String::with_capacity(line.len() * 2);

    let pairs = LineParser::parse(Rule::Line, line)?;
    let line_rule = pairs.into_iter().next().unwrap();
    debug_assert_eq!(Rule::Line, line_rule.as_rule());

    let blocks = line_rule.into_inner();

    let first = blocks.peek().unwrap();
    let mut prev_block_kind = first.as_rule();
    result.push_str(first.as_str());

    for block in blocks.into_iter().skip(1) {
         match (prev_block_kind, block.as_rule()) {
            (_, Rule::EOI) => break,
            // keep MultiSpace
            (_, Rule::MultiSpace) | (Rule::MultiSpace, _)
            // no space around FullWidth punct 
            | (_, Rule::FWPunct) | (Rule::FWPunct, _)
            // no space before punct
            | (_, Rule::Punct)
            // keep other intact
            | (_, Rule::Other) | (Rule::Other, _)
             => {
                result.push_str(block.as_str());
            }
            (_, _) => {
                // default add space
                result.push(' ');
                result.push_str(block.as_str())
            },
        }
        prev_block_kind = block.as_rule();
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use crate::parser::*;

    #[derive(Default)]
    struct Tester<'a> {
        name: &'a str,
        cases: Vec<(&'a str, &'a str)>,
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

        fn test(&self) {
            for (i, (case, want)) in self.cases.iter().enumerate() {
                let got = insert_liberty(case).unwrap();
                assert_eq!(
                    &got.as_str(),
                    want,
                    "bad case is Group {:?} number {} case",
                    self.name,
                    i
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
                ("", ""),
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
            ])
            .test();
    }
}
