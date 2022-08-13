Q: How does auto-space work internally?

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

**By default, a space is added between each type**. However, there are several cases where spaces are not added:

1. `MultiSpace` and the surrounding blocks
1. `FWPunct` and surrounding blocks
1. `Other` and the surrounding blocks
1. `Punct` and the block on the left


Q: How does converting rules work internally?

A: A hand-written rule parser parses user rules and organized them in a trie tree. The common pattern can be expressed as: **initial string + a trigger character = result string**
