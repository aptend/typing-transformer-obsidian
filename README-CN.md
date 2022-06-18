

## Typing-transformer Obsidian

Typing Transformer 受到 [Easy Typing](https://github. com/Yaozhuwa/easy-typing-obsidian) 启发, 感谢 Easy Typing !

Typing transofrmer 拥有更简洁的内部规则，更灵活的配置能力，让用户拥有定制的自动格式化体验



### 可配置的输入转换


Typing trasnformer 支持输入时自动展开预定义的 snippets.

比如现在配置一条如下的规则

```
dpx¦ -> don't panic¦
```

其中 `¦` 表示光标位置。`dpx¦` 是触发规则，当输入 `dp` 后，再输入 `x`，将会触发转换，已输入的 `dp` 将被 `don't panic` 替代，光标置于 `panic` 末尾。

通用的模式可以这样表示：**初始字符串 + 一个触发字符 = 结果字符串**

这个模式除了帮助我们展开缩略短语，还能处理符号转换，比如自动配对符号，或者全角符号转半角符号
- `《¦ -> 《¦》` 规则描述了自动配对中文的书名号，并且将光标置于已配对符号的中间
- `。。¦ -> .¦` 规则描述了两个中文句号转变为一个英文句号


### 选中区域两侧加入成对全角符号


### 自动加入空格

