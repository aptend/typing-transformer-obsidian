Q: How does auto-space work internally?

A: A simple syntax parsing rule is written using [pest.rs](https://pest.rs/) to divide a sentence into multiple block types like these:

```pest
Block = _{ 
    MultiSpace     // multiple consecutive spaces
    | Space        // single space
    | SpecialBlock // inline code, math block, URL, time etc.
    | InlineEm     // **<XXX>** block of markdown
    | Punct        // halfwidth punctuation
    | FWPunct      // fullwidth punctuation
    | Num          // number
    | Cn           // Chinese
    | Eng          // English
    | Other        // character blocks other than the above types
}
```

**By default, a space is added between each type**. However, there are several cases where spaces are not added:

1. `MultiSpace` and the surrounding blocks
1. `FWPunct` and the surrounding blocks
1. `Other` and the surrounding blocks
1. `Punct` and the block on the left

For example, the line of `秦时moon汉时关，  万里长征人no还` will be divided into blocks:

- Cn: "秦时"
- Eng: "moon"  --- insert a space before Eng
- Cn: "汉时关"  --- insert a space before Cn
- FWPunct: "，" --- DO NOT add spaces before or after FWPunct
- MultiSpace: "  " --- DO NOT add spaces before or after MultiSpace
- Cn: "万里长征人" --- DO NOT add spaces after MultiSpace
- Eng: "no" --- add a space before Eng
- Cn: "还" --- add a space before Cn
- EOF

Therefore, the result is `秦时 moon 汉时关，  万里长征人 no 还`

Q: How does converting rules work internally?

A: A hand-written rule parser parses user rules and organized them in a trie tree. The common pattern can be expressed as: **initial string + a trigger character = result string**
