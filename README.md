<p align="right"><strong>English</strong> | <a href="https://github.com/aptend/typing-transformer-obsidian/blob/main/README-CN.md">中文</a></p>

---

Typing Transformer is the plugin that will literally transform your typing.

Typing Transformer has clean internal rules, flexible configuration and allows users to have a customized auto-formatting experience as typing.

Typing Transformer is inspired by [Easy Typing](https://github.com/Yaozhuwa/easy-typing-obsidian). Thanks to Easy Typing!

**Note: The implementation depends on CodeMirror6 and only works in non-legacy mode in Obsidian 0.14.15 or later**

![conversion](https://user-images.githubusercontent.com/49832303/175769416-c0fce828-cf72-4d2d-b74d-8bf35f78ce27.gif)

There are three main types of rules: 

1. input conversion rules
2. deletion rules
3. selection rules

## Input Conversion Rules

A conversion rule has the following syntax:

```
'<trigger>' -> '<result>'
```
*Anything in angled brackets are replaced*

### Example 1: Expanding Abbreviated Phrases
```
'dpx|' -> 'don\'t panic|'
```
The trigger of the rule is `dpx|`

**Notice `|` in both the trigger and the result. It indicates where cursor position should be for the rule to be triggered.**

When `dp` is entered and `x` follows, the cursor will be after `x`, which triggers the conversion. 

Everything will then be replaced with the result: `don\'t panic|`.

In this case, `|` indicates the cursor position after the conversion. (You can place it anywhere in the text.)
### Example 2: Auto-pairing of symbols
gif

The trigger is `《`.

The rule auto-pairs Chinese bookmarks and places the cursor in the middle.

explanation
### Example 3: Transformation of two full width characters into one half width character
gif 

This rule works with the one above.

1. When a `《` is entered, the second rule auto-pairs it.
2. When another `《` is entered, the first rule will take priority because it matches. 
3. The auto-pair rule won't do anything yet. This results in `《《|》`.
4. This is then converted by the first rule, by the first rule, into `<`.

**More examples can be found in the settings page of this plugin. Have fun converting!**

## Deletion Rules (tbd)

A conversion rule has the following syntax:

```
'<deletion trigger>' -x '<result>'
```
*Anything in angled brackets are replaced*

Deletion rules are essentially the reverse of input conversion rules, but the deletion of a certain character acts as the trigger.

## Selection Rules

The syntax of a selection rule is as follows:

```
'<trigger (one char)>' -> '<left insert>' + '<right insert>'
```
*Anything in angled brackets are replaced*

When text is selected and **one** character is entered, Typing Transformer will help you insert two characters on each side of the selection.

### Example 1: Selection auto-pair of <angled brackets>
gif

The auto-pairing of angled brackets make typing html a lot easier!

These rules are supported by default:

```
'·'  -> '\`' + '\`'
'￥'  -> '$' + '$'
'《'  -> '《' + '》'
'<'  -> '<' + '>'
```

## Format line with spaces

When typing in multiple languages, inserting spaces between different language blocks will bring a better reading experience. Of course, Typing Transformer can help you with the addition of spaces.

![add spaces](https://user-images.githubusercontent.com/49832303/175770015-6dba97d6-5eb2-4d30-a28d-e7ae061c2e7a.gif)

In most cases, the range of auto-formatting is a short sentence, and the actual processing part will have "⭐️" to indicate the starting point and have the current cursor position to be the end point. The timing of the formatting is usually when you enter a sentence punctuation, such as a comma, a period, a space can also do.