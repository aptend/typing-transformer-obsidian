mod parser;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct LinePlan {
    pub from: usize,
    pub to: usize,
    edits: Vec<usize>,
}

#[wasm_bindgen]
impl LinePlan {
    // Pairs of UTF-16 offsets: equal offsets insert one space; a nonempty range removes one.
    #[wasm_bindgen(js_name=takeEdits)]
    pub fn take_edits(&mut self) -> Vec<usize> {
        std::mem::take(&mut self.edits)
    }
}

#[wasm_bindgen(js_name=planLine)]
pub fn plan_line(line: &str, cursor_utf16: usize) -> Option<LinePlan> {
    let plan = parser::plan_line(line, cursor_utf16)?;
    Some(LinePlan {
        from: plan.zone.start,
        to: plan.zone.end,
        edits: plan
            .edits
            .into_iter()
            .flat_map(|gap| [gap.start, gap.end])
            .collect(),
    })
}
