<script lang="ts">
  import { Annotation, type Extension } from "@codemirror/state";
  import { EditorView, ViewUpdate, lineNumbers } from "@codemirror/view";
  import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
  import { python } from "@codemirror/lang-python";
  import { tags as t } from "@lezer/highlight";
  import InnerEditor from "./InnerEditor.svelte";
  import ValidityIndicator from "./ValidityIndicator.svelte";
  import type TypingTransformer from "../main";

  // use context?
  export let plugin: TypingTransformer;

  let errors: string[] = null;
  let cm: InnerEditor;

  const ProfileSwitch = Annotation.define<boolean>();
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

  const obsidianHighlightStyle = HighlightStyle.define([
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

  const obsidianTheme = EditorView.theme({
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

  const extensions: Extension[] = [
    obsidianTheme,
    lineNumbers(),
    EditorView.lineWrapping,
    python(), // it is better to write a language support for rules
    syntaxHighlighting(obsidianHighlightStyle),
    EditorView.updateListener.of(async (v: ViewUpdate) => {
      if (v.docChanged) {
        let hasSwitchAnno = false;
        v.transactions.forEach((tr) => hasSwitchAnno = hasSwitchAnno || tr.annotation(ProfileSwitch));
        if (hasSwitchAnno) return;
        const value = v.state.doc.toString();
        errors = plugin.checkRules(value); // trigger update validityIndicator
      }
    }),
  ];
</script>

<InnerEditor
  bind:this={cm}
  initContent="# rule editor!"
  initExts={extensions}
/>
<ValidityIndicator errors={errors}/>

<button
  on:click={() => {
    cm.setEditorContent("# new profile", [ProfileSwitch.of(true)]);
    errors = null;
  }}
>
  Force Switch Profile
</button>
