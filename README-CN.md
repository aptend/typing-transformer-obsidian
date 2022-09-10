<p align="right"><a href="https://github.com/aptend/typing-transformer-obsidian/blob/main/README.md">English</a> | <strong>中文</strong> </p>

---

Typing transofrmer 插件如其名，可以转换你的输入字符。它拥有简洁的内部规则，灵活的配置能力，让用户拥有定制的自动格式化体验。

Typing Transformer 受到 [Easy Typing](https://github.com/Yaozhuwa/easy-typing-obsidian) 启发, 感谢 Easy Typing!

**注意: Typing transformer 的实现依赖于 CodeMirror6，只能在 Obsidian 0.14.15 或更高的版本中的非 Legacy 模式生效**

Typing Transformer 目前支持三种类型的转换规则：
1. [输入规则](#输入规则)
2. [删除规则](#删除规则)
3. [选中规则](#选中规则)

另外，Typing Transformer 支持自动格式化，在多语种、特定符号之间[插入空格](#插入空格)。

## What's New in 0.3.0

- 更好的 README.md
- 删除规则
- 选中规则支持插入多个字符
- 规则编辑器的错误信息更可读
- 规则编辑器可以拖动改变大小
- 修复自动格式化 bug (输入 url 和时间时不会被打断)

特别感谢 [@caasion](https://github.com/caasion) 在 0.3 版本中的出色想法和工作。

## 输入规则

输入规则用途很多，在此可以充分发挥你的创意。比如展开缩略短语，自动添加成对符号，不切换输入法转换全角符号，拼写错误自动矫正等等，更多场景等待你的发现！

一条输入规则有如下的配置语法:

```coffeescript
'<trigger>' -> '<result>'
```
*尖括号及其的内容仅表示格式，需被替换为实际内容*

### 例1: 展开缩略短语
![dpx](https://user-images.githubusercontent.com/49832303/184522399-e0c25d5b-4aad-4c0e-a03a-956fbf3965bb.gif)


当输入 `dp` 后，再输入触发字符 `x`，转换立即发生，`dpx` 被 `don't panic|` 替代。

*注意：`|` 表示光标位置，可以放置在文本的任意位置*

### 例2: 符号自动配对
![auto-pair](https://user-images.githubusercontent.com/49832303/185430735-8601bd41-077f-417c-96bc-c57f3428bf5a.gif)

这条规则里，触发字符是 `《`，效果是自动配对中文书名号，并且将光标置于已配对符号的中间。

### 例3: 全角字符转半角
![auto-pair and transformation](https://user-images.githubusercontent.com/49832303/185430769-84c12d45-0ee4-434c-80a6-04466cebb9bd.gif)


基于上一个例子，可以把已配对的全角字符继续变为单个半角符号。过程如下：

1. 当输入一个 `《`，匹配第二个规则，发生自动配对
2. 再输入一个 `《`，会匹配到第一个规则，它有更高优先级
3. 因为自动配对不生效，所以当前内容可以看做是 `《《|》`
4. 第一个规则转换出结果，`<`

*注意：**先定义的规则有更高优先级***

**更多的规则可以参考 Typing Transformer 的设置页面，有助于你自己的规则创建!**

## 删除规则

删除转换和输入转换相反: 删除一个特定字符时会触发转换。通常可以和自动配对规则配合使用，达到快速清理的效果。

一条删除规则有如下的语法：
```coffeescript
'<deletion trigger>' -x '<result>'
```
*尖括号及其的内容仅表示格式，需被替换为实际内容*

### 例1：删除成对符号
![pair deletion](https://user-images.githubusercontent.com/103465188/186443468-46a21ef9-1bc6-4de2-a1bd-187c8069e8e8.gif)

### 例2：删除星号

![asterisks deletion](https://user-images.githubusercontent.com/103465188/186443487-484bd969-2c16-42ec-824c-cebc1799431c.gif)

## 选中规则

选中规则帮助你在选中文本两侧插入任意字符，触发条件是选中文本并且输入**一个**触发字符

一条选中规则有如下的语法：
```coffeescript
'<trigger>' -> '<left insert>' + '<right insert>'
```
*尖括号及其的内容仅表示格式，需被替换为实际内容*

### 例1：选中区域自动配对尖括号

![selection](https://user-images.githubusercontent.com/49832303/185430794-c734358b-8dd4-4cc0-9856-d6e39d27b777.gif)


目前默认支持的规则有：

```coffeescript
'·'  -> '\`' + '\`'
'￥'  -> '$' + '$'
'《'  -> '《' + '》'
'<'  -> '<' + '>'
```

## 自动加入空格

多种语言混合输入时，如果在不同语言块之间插入空格，会带来更好的阅读体验。当然，Typing Transformer 可以帮助你完成空格的添加。

![add spaces](https://user-images.githubusercontent.com/49832303/175770015-6dba97d6-5eb2-4d30-a28d-e7ae061c2e7a.gif)


自动格式化一般按一个短句进行，发生在输入一个短句标点时，比如逗号，句号，空格。实际处理部分将会有 "⭐️" 表示起点，终点则是当前光标位置。

*注意：自动格式化目前仅支持中文和英文*

了解更多内部原理，参考文档 [How it works.md](https://github.com/aptend/typing-transformer-obsidian/blob/main/docs/How%20it%20works.md)