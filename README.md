

<p align="right"><strong>English</strong> | <a href="https://github.com/aptend/typing-transformer-obsidian/blob/main/README-CN.md">中文</a></p>



Typing Transformer is inspired by [Easy Typing](https://github.com/Yaozhuwa/easy-typing-obsidian), thanks to Easy Typing!

Typing Transofrmer has clean internal rules, flexible configuration and allows users to have a customized auto-formatting experience as typing


## Configurable input conversion


Typing Trasnformer supports automatic expansion of predefined snippets on input.

![conversion](https://user-images.githubusercontent.com/49832303/175769416-c0fce828-cf72-4d2d-b74d-8bf35f78ce27.gif)

For example, a rule is now configured as follows

```
dpx| -> don't panic|
```

where `|` indicates the cursor position. `dpx|` is the trigger rule, when `dp` is entered and then `x` follows, the conversion is triggered and the entered `dp` will be replaced by `don't panic` and the cursor will be placed at the end of `panic`.


The generic pattern can be expressed as: **initial string + a trigger character = result string**

In addition to helping us expand abbreviated phrases, this pattern can also handle symbol conversions, such as auto-pairing symbols, or turning fullwidth symbols into halfwidth ones, examples:
- `《| -> 《|》` rule describes the automatic matching of Chinese book marks and placing the cursor in the middle
- `。。| -> .|` rule describes the transformation of two Chinese periods into one English period

Refer to more rules in the setting page of Typing Transfomer and have fun converting!

## Insert paired symbols to selection

When an area is selected and some fullwidth symbols are entered, corresponding paired symbols are automatically added to both sides of the selected area for easy markdown formatting.

The following symbols are currently supported.

- `selected` + `·` -> `` `selected` ``
- `selected` + `￥` -> `$selected$`
- `selected` + `“` or `”` -> `“selected”`


## Format line with spaces

When typing in multiple languages, inserting spaces between different language blocks will bring a better reading experience. Of course, Typing Transformer can help you with the addition of spaces.

![add spaces](https://user-images.githubusercontent.com/49832303/175770015-6dba97d6-5eb2-4d30-a28d-e7ae061c2e7a.gif)

In most cases, the range of auto-formatting is a short sentence, and the actual processing part will have "⭐️" to indicate the starting point and have the current cursor position to be the end point. The timing of the formatting is usually when you enter a sentence punctuation, such as a comma, a period, a space can also do.

Q: How does it work internally?

A: A simple syntax parsing rule is written using [pest.rs](https://pest.rs/) to divide a sentence into multiple block types like these:

```pest
Block = _{ 
    MultiSpace     // multiple consecutive spaces
    | WHITSPACE    // single space
    | SpecialBlock // inline code block or math block etc.
    | Punct        // halfwidth punctuation
    | FWPunct      // fullwidth punctuation
    | Num          // number
    | Cn           // Chinese
    | Eng          // English
    | Other        // character blocks other than the above types
}
```

**By default, a space is added between each type**. However, there are several cases where spaces are not added

1. `MultiSpace` and the surrounding blocks
1. `FWPunct` and surrounding blocks
1. `Other` and the surrounding blocks
1. `Punct` and the block on the left
