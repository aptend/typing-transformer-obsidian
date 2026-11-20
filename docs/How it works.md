## Q: How does auto-formatting work internally?

When you type a trigger such as a comma, period, or space, the editor asks the Rust formatter for a plan for the active line. Fenced code and math blocks are filtered using the current note's metadata.

The formatter finds the fragment ending at the cursor using the previous sentence mark as its starting point. A period inside a number or version, or punctuation inside recognized inline code, math, or links, does not split the fragment. If the cursor is inside one of those protected regions, the formatter leaves the text alone. When editing inside recognized emphasis, it uses the whole emphasis body as context so the closing delimiter and any protected content after the cursor remain visible.

Spacing is defined for specific pairs of neighbors. A Han character touching an ASCII letter or digit gets one intervening space, so `测试A4纸` becomes `测试 A4 纸` without splitting `A4`. Names like `p_cache` stay together as well. Separate rules handle punctuation and spacing around recognized inline markup. Runs of multiple spaces, tabs, and the contents of protected regions are preserved.

The result contains the fragment range for the ⭐️ indicator and the individual space insertions or deletions. Positions are UTF-16 offsets from the start of the line, matching the editor even when the line contains emoji. The editor applies all the changes together, so a single undo reverses the automatic spacing.

## Q: How do converting rules work internally?

A: A hand-written rule parser parses user rules and organizes them in a trie tree. The common pattern can be expressed as: **`initial string + a trigger character = result string`**
