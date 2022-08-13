<p align="right"><strong>English</strong> | <a href="https://github.com/aptend/typing-transformer-obsidian/blob/main/README-CN.md">中文</a></p>

# Typing Transformer Obsidian

Typing Transformer is the plugin that will literally transform your typing.

Typing Transformer has clean internal rules, flexible configuration and allows users to have a customized auto-formatting experience as typing.

Typing Transformer is inspired by [Easy Typing](https://github.com/Yaozhuwa/easy-typing-obsidian). Thanks to Easy Typing!

**Note: The implementation depends on CodeMirror6 and only works in non-legacy mode in Obsidian 0.14.15 or later**

![conversion](https://user-images.githubusercontent.com/49832303/175769416-c0fce828-cf72-4d2d-b74d-8bf35f78ce27.gif)

<!-- TODO: needs a better gif -->

Typing Transformer currently supports three types of transformation rules:
1. [input conversion rules](https://github.com/caasion/typing-transformer-obsidian/tree/docs#input-conversion-rules)
2. [deletion rules](https://github.com/caasion/typing-transformer-obsidian/tree/docs#deletion-rules-tbd)
3. [selection rules](https://github.com/caasion/typing-transformer-obsidian/tree/docs#selection-rules)

In addition, Typing Transformer has auto-formatting features such as [inserting spaces](https://github.com/caasion/typing-transformer-obsidian/tree/docs#formatting-lines-with-spaces) between multiple languages and certain symbols.

<!-- NOTE TO APTEND: You will need to replace these links with your own that link to your repository -->

<!-- TODO: Latest update features 
## What's New in Version x.x.x?
- Deletion Rules
-->

## Input Conversion Rules

A conversion rule has the following syntax:

```
'<trigger>' -> '<result>'
```
*Anything in angled brackets are replaced*

### Example 1: Expanding Abbreviated Phrases
![](https://github.com/caasion/typing-transformer-obsidian/blob/docs/docs/dpx.gif)


When `dp` is entered and `x` follows, the cursor will be after `x`, which triggers the conversion. 

Everything will then be replaced with the result: `don\'t panic|`.

`|` indicates the cursor position after the conversion. (You can place it anywhere in the text.)

### Example 2: Auto-pairing of symbols
![](https://github.com/caasion/typing-transformer-obsidian/blob/docs/docs/auto-pair.gif)

The trigger is `《`.

The rule auto-pairs Chinese bookmarks and places the cursor in the middle.

explanation
### Example 3: Transformation of two full width characters into one half width character
![](https://github.com/caasion/typing-transformer-obsidian/blob/docs/docs/auto-pair%20and%20transformation.gif)

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
![](https://github.com/caasion/typing-transformer-obsidian/blob/docs/docs/selection.gif)

The auto-pairing of angled brackets make typing html a lot easier!

These rules are supported by default:

```
'·'  -> '\`' + '\`'
'￥'  -> '$' + '$'
'《'  -> '《' + '》'
'<'  -> '<' + '>'
```

## Formatting Lines with Spaces

When typing in multiple languages, inserting spaces between different language blocks will bring a better reading experience. Of course, Typing Transformer can help you with the addition of spaces.

![add spaces](https://user-images.githubusercontent.com/49832303/175770015-6dba97d6-5eb2-4d30-a28d-e7ae061c2e7a.gif)

In most cases, the range of auto-formatting is a short sentence, and the actual processing part will have "⭐️" to indicate the starting point and have the current cursor position to be the end point. The timing of the formatting is usually when you enter a sentence punctuation, such as a comma, a period, a space can also do.

<!-- TODO：Needs more information. (Please answer these questions)
What languages are supported?
When does the insertion of space happen?
When does it NOT happen?
-->
