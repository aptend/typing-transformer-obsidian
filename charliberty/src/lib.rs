#[macro_use]
extern crate pest_derive;

mod parser;

use parser::insert_liberty;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name=formatLine)]
pub fn format_line(line: &str) -> String {
    insert_liberty(line).unwrap()
}
