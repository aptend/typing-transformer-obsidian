

# Typing-transformer Obsidian

Typing Transformer 受到 [Easy Typing](https://github.com/Yaozhuwa/easy-typing-obsidian) 启发, 感谢 Easy Typing !

Typing transofrmer 拥有简洁的内部规则，灵活的配置能力，让用户拥有定制的自动格式化体验

**注意: Typing transformer 的实现依赖于 CodeMirror6，只能在 Obsidian 0.13.8 或更高的版本中的非 Legacy 模式生效**


### 可配置的输入转换

Typing trasnformer 支持输入时自动展开预定义的 snippets。

![conversion](https://user-images.githubusercontent.com/49832303/175769416-c0fce828-cf72-4d2d-b74d-8bf35f78ce27.gif)

比如现在配置一条如下的规则

```
dpx| -> don't panic|
```

其中 `|` 表示光标位置。`dpx|` 是触发规则，当输入 `dp` 后，再输入 `x`，将会触发转换，已输入的 `dp` 将被 `don't panic` 替代，光标置于 `panic` 末尾。

通用的模式可以这样表示：**初始字符串 + 一个触发字符 = 结果字符串**

这个模式除了帮助我们展开缩略短语，还能处理符号转换，比如自动配对符号，或者全角符号转半角符号，比如
- `《| -> 《|》` 规则描述了自动配对中文的书名号，并且将光标置于已配对符号的中间
- `。。| -> .|` 规则描述了两个中文句号转变为一个英文句号

更多的规则可以参考 Typing Transformer 的设置页面，有助于你自己的规则创建!

### 选中区域两侧加入成对符号

当选中一块区域，并输入某些全角符号时，会自动在选中区域两侧加入对应的成对符号，方便进行 markdown 的格式调整。

目前支持的符号有：

- `selected` + `·` -> `` `selected` ``
- `selected` + `￥` -> `$selected$`
- `selected` + `“` 或 `”` -> `“selected”`

### 自动加入空格

多种语言混合输入时，如果在不同语言块之间插入空格，会带来更好的阅读体验。当然，Typing Transformer 可以帮助你完成空格的添加。

![add spaces](https://user-images.githubusercontent.com/49832303/175770015-6dba97d6-5eb2-4d30-a28d-e7ae061c2e7a.gif)


自动格式化的范围大部分情况下是一个短句，实际处理部分将会有 "⭐️" 表示起点，终点则是当前光标位置。格式化的时机，一般是输入一个短句标点时，比如逗号，句号，空格也可以



Q: 内部是如何实现的?

A: 利用了 [pest.rs](https://pest.rs/) 编写了一个简单的语法解析规则，将一句话分为了多种块类型

```pest
Block = _{ 
    MultiSpace     // 多个连续空格
    | WHITSPACE    // 单一空格
    | SpecialBlock // 特殊语法块，比如代码块和公式块
    | Punct        // 半角断句标点
    | FWPunct      // 全角短句标点
    | Num          // 数字
    | Cn           // 中文
    | Eng          // 英文
    | Other        // 除上述类型外的字符块
}
```

**默认对每个类型之间加入一个空格**。但有几种情况不加入空格

1. `MultiSpace` 和周围的 block
1. `FWPunct` 和周围的 block
1. `Other` 和周围的 block
1. `Punct` 和左侧的 block

