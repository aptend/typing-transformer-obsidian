

<p align="right"><strong>English</strong> | <a href="https://github.com/aptend/typing-transformer-obsidian/blob/main/README-CN.md">中文</a></p>

---
# Obsidian Typing Transformer

Typing Transformer is inspired by [Easy Typing](https://github.com/Yaozhuwa/easy-typing-obsidian), thanks to Easy Typing!

Typing Transofrmer has clean internal rules, flexible configuration and provides users a customized auto-formatting experience as typing

**Note: The implementation depends on CodeMirror6 and only works in non-legacy mode in Obsidian 0.14.15 or later**

## Input Conversion

Typing Transformer supports automatic expansion of predefined snippets on input.

![dpx](https://user-images.githubusercontent.com/103465188/183317743-3ee2a6b2-2b08-427b-886d-d212d4c94fb8.gif)

When `dp` is followed by `x`, the conversion is triggered and `dpx` turns into `don't panic`.

`dpx|` is the trigger rule and `don\'t panic|` is the conversion result. `|` indicates the cursor position (you can place the cursor anywhere in the trigger rule or conversion result).

*Note: Some special characters such as `'`, `"`, or the literal `|` character have to be escaped with a backslash.*

---
In addition to helping us expand abbreviated phrases, this plugin can also handle symbol conversions.

You can auto-pair bracekts:

![autopair](https://user-images.githubusercontent.com/103465188/183318512-d5c5d65b-5b4e-464e-a453-b39c5775fdc1.gif)
- `'<|' -> '<|>'` auto-pairs angled brackets and places the cursor in the middle (as indicated by `|`)
- `'《|' -> '《|》'` auto-pairs Chinese bookmarks and places the cursor in the middle (as indicated by `|`)

or turn full width characters into half width ones:

![width conversion](https://user-images.githubusercontent.com/103465188/183317990-66464aec-9a87-46fe-9809-04d13e77e9b4.gif)
- `'。。|' -> '.|'` transforms of two Chinese periods `。` into one English period `.`



**Refer to more rules in the setting page of Typing Transfomer and have fun converting!**

## Auto-pairing selection rule

When an area is selected and a trigger character are entered, corresponding paired symbols are automatically added to both sides of the selected area.

The following symbols are currently supported by default:

- `sel` + `·` -> `` `sel` ``
- `sel` + `￥` -> `$sel$`
- `sel` + `<`  -> `<sel>`
- `sel` + `《`  -> `《sel》`

As with the conversion rules, **selection rules can also be created in the Typing Transformer's settings page**. The basic format is:

`'<trigger char>' -> '<left-insert-char>' + '<right-insert-char>'`

## Format line with spaces

When typing in multiple languages, inserting spaces between different language blocks will bring a better reading experience. Of course, Typing Transformer can help you with the addition of spaces.

![add spaces](https://user-images.githubusercontent.com/49832303/175770015-6dba97d6-5eb2-4d30-a28d-e7ae061c2e7a.gif)

In most cases, the range of auto-formatting is a short sentence, and the actual processing part will have "⭐️" to indicate the starting point and have the current cursor position to be the end point. The timing of the formatting is usually when you enter a sentence punctuation, such as a comma, a period, a space can also do.
