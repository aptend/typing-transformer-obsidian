import { EditorView } from "@codemirror/view";
import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

import type TypingTransformer from "../main";

export let plugin: TypingTransformer;

const config = {
    name: "obsidian",
    dark: false,
    background: "var(--background-primary)",
    foreground: "var(--text-normal)",
    selection: "var(--text-selection)",
    cursor: "var(--text-normal)",
    activeLine: "var(--background-primary)",
    string: "var(--text-accent)",
    constant: "var(--text-accent-hover)",
    comment: "var(--text-faint)",
    invalid: "var(--text-error)",
  };


export const obsidianHighlightStyle = HighlightStyle.define([
    {
        tag: [t.processingInstruction, t.string, t.inserted, t.special(t.string)],
        color: config.string,
    },
    {
        tag: [t.color, t.constant(t.name), t.standard(t.name)],
        color: config.constant,
    },
    { tag: t.comment, color: config.comment },
    { tag: t.invalid, color: config.invalid },
]);

export const obsidianTheme = EditorView.theme({
    "&": {
        color: config.foreground,
        backgroundColor: config.background,
    },
    ".cm-content": { caretColor: config.cursor },
    "&.cm-focused .cm-cursor": { borderLeftColor: config.cursor },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, & ::selection":
        { backgroundColor: config.selection },
    ".cm-activeLine": { backgroundColor: config.activeLine },
    ".cm-activeLineGutter": { backgroundColor: config.background },
    ".cm-selectionMatch": { backgroundColor: config.selection },
    ".cm-gutters": {
        backgroundColor: config.background,
        color: config.comment,
        borderRight: "1px solid var(--background-modifier-border)",
    },
    ".cm-lineNumbers, .cm-gutterElement": { color: "inherit" },
});