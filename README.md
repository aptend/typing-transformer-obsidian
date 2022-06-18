

## Typing Transformer in Obsidian

Typing Transformer is inspired by [Easy Typing](https://github. com/Yaozhuwa/easy-typing-obsidian) 启发, thanks to Easy Typing!

Typing Transofrmer has cleaner internal rules, more flexible configuration and allows users to have a customized auto-formatting experience as typing



### Configurable input conversion


Typing Trasnformer supports automatic expansion of predefined snippets on input.

For example, a rule is now configured as follows

```
dpx¦ -> don't panic¦
```

where `¦` indicates the cursor position. `dpx¦` is the trigger rule, when `dp` is entered and then `x` follws, the conversion is triggered and the entered `dp` will be replaced by `don't panic` and the cursor will be placed at the end of `panic`.


The generic pattern can be expressed as: ** initial string + a trigger character = result string**

In addition to helping us expand abbreviated phrases, this pattern can also handle symbol conversions, such as auto-pairing symbols, or fullwidth to halfwidth symbols, examples:
- `《¦ -> 《¦》` rule describes the automatic matching of Chinese book marks and placing the cursor in the middle
- `。。¦ -> .¦` rule describes the transformation of two Chinese periods into one English period


Have fun converting!

### Insert paired fullwidth symbols to selection


### Format line with spaces
