#[macro_use]
extern crate pest_derive;

mod parser;

use parser::{block_ranges, insert_liberty};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name=formatLine)]
pub fn format_line(line: &str) -> String {
    insert_liberty(line).unwrap()
}

#[wasm_bindgen(js_name=getBlockRanges)]
pub fn get_block_ranges(line: &str, cursor_pos: usize) -> Vec<usize> {
    block_ranges(line, cursor_pos)
}
