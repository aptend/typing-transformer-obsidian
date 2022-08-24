<p align="right"><strong>English</strong> | <a href="https://github.com/aptend/typing-transformer-obsidian/blob/main/README-CN.md">中文</a></p>

# Typing Transformer Obsidian

Typing Transformer is a plugin packed with features that will literally transform your typing. It has clean internal rules, flexible configuration and allows users to have a customized auto-formatting experience as typing.

Typing Transformer is inspired by [Easy Typing](https://github.com/Yaozhuwa/easy-typing-obsidian). Thanks to Easy Typing!

*Note: The implementation depends on CodeMirror6 and only works in non-legacy mode in Obsidian 0.14.15 or later*

Typing Transformer currently supports three types of transformation rules:
1. [Input Conversion Rules](#input-conversion-rules)
2. [Deletion Rules](#deletion-rules-tbd)
3. [Selection Rules](#selection-rules)

In addition, Typing Transformer has auto-formatting features such as [inserting spaces](#formatting-lines-with-spaces) between multiple languages and certain symbols.

## What's New in 0.3.0?

- Better README.md
- Deletion rules
- Selection now supports inserting multiple characters
- Improved error messages in editor
- Resizable rule editor
- Fixed bugs in auto formatting (no longer adds spaces when typing URLs and time)

## Input Conversion Rules

Input conversion rules are versatile and can be used in creative ways. These include expanding abbreviated phrases, auto-pairing symbols, transofrmation of full-width characters, auto correct and more!

An input conversion rule has the following syntax:
```coffeescript
'<trigger>' -> '<result>'
```
*Anything in angled brackets are replaced*

### Example 1: Expanding Abbreviated Phrases
![dpx](https://user-images.githubusercontent.com/49832303/184522399-e0c25d5b-4aad-4c0e-a03a-956fbf3965bb.gif)

When `dp` is entered and `x` follows, the cursor will be after `x`, which triggers the conversion. 

Everything will then be replaced with the result: `don\'t panic|`.

*Note: `|` indicates the cursor position after the conversion. (You can place it anywhere in the text.)*

### Example 2: Auto-pairing of symbols
![auto-pair](https://user-images.githubusercontent.com/49832303/185430735-8601bd41-077f-417c-96bc-c57f3428bf5a.gif)

The trigger of the rule is `《` and the rule auto-pairs Chinese bookmarks and places the cursor in the middle.

### Example 3: Transformation of two full width characters into one half width character
![auto-pair and transformation](https://user-images.githubusercontent.com/49832303/185430769-84c12d45-0ee4-434c-80a6-04466cebb9bd.gif)
This rule works with the one above.

1. When a `《` is entered, the second rule auto-pairs it.
2. When another `《` is entered, the first rule will take priority because it matches. 
3. The auto-pair rule won't do anything yet. This results in `《《|》`.
4. This is then converted by the first rule, by the first rule, into `<`.

*Note: **Rules that come first have higher priority**, so the conversion into full width characters must come first before the auto-pairing*

**More examples can be found in the settings page of this plugin. Have fun converting!**

## Deletion Rules

Deletion rules are the reverse of input conversion rules; the deletion of a certain character acts as the trigger. These can be used with auto-pairing rules to fully power-up your typing.

A deletion rule has the following syntax:
```coffeescript
'<deletion trigger>' -x '<result>'
```
*Anything in angled brackets are replaced*

### Example 1: Deletion of a pair of brackets

![pair deletion](https://user-images.githubusercontent.com/103465188/186443468-46a21ef9-1bc6-4de2-a1bd-187c8069e8e8.gif)

### Example 2: Quick Deletion of Asterisks

![asterisks deletion](https://user-images.githubusercontent.com/103465188/186443487-484bd969-2c16-42ec-824c-cebc1799431c.gif)

## Selection Rules

Selection rules will help your insert characters on both sides of the selected text when **one** trigger character is entered

The syntax of a selection rule is as follows:
```coffeescript
'<trigger>' -> '<left insert>' + '<right insert>'
```
*Anything in angled brackets are replaced*

### Example 1: Selection auto-pair of <angled brackets>
![selection](https://user-images.githubusercontent.com/49832303/185430794-c734358b-8dd4-4cc0-9856-d6e39d27b777.gif)

The auto-pairing of angled brackets make typing HTML a lot easier!

These rules are supported by default:
```coffeescript
'·'  -> '\`' + '\`'
'￥'  -> '$' + '$'
'《'  -> '《' + '》'
'<'  -> '<' + '>'
```

## Formatting Lines with Spaces

When typing in multiple languages, inserting spaces between different language blocks will bring a better reading experience. Of course, Typing Transformer can help you with the addition of spaces.

![add spaces](https://user-images.githubusercontent.com/49832303/175770015-6dba97d6-5eb2-4d30-a28d-e7ae061c2e7a.gif)

In most cases, the range of auto-formatting is a short sentence, and the actual processing part will have "⭐️" to indicate the starting point and have the current cursor position to be the end point. The timing of the formatting is usually when you enter a sentence punctuation, such as a comma, a period, a space can also do.
