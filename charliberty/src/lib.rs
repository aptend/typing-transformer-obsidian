#[macro_use]
extern crate pest_derive;

mod parser;

use parser::{block_ranges, insert_liberty};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name=formatLine)]
pub fn format_line(line: &str) -> String {
    insert_liberty(line).unwrap()
}

#[wasm_bindgen]
pub struct Blocks {
    special: Vec<usize>,
    emphasis: Vec<usize>,
}

#[wasm_bindgen]
impl Blocks {
    #[wasm_bindgen(getter)]
    pub fn special(&self) -> Vec<usize> {
        self.special.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn emphasis(&self) -> Vec<usize> {
        self.emphasis.clone()
    }
}

#[wasm_bindgen(js_name=getBlockRanges)]
pub fn get_block_ranges(line: &str, cursor_pos: usize) -> Blocks {
    let (sp, em) = block_ranges(line, cursor_pos);
    Blocks {
        special: sp,
        emphasis: em,
    }
}
