<script lang="ts">
    import { onMount } from 'svelte';
    import { python } from '@codemirror/lang-python';
    import { lineNumbers, EditorView, ViewUpdate } from '@codemirror/view';
    import { Annotation, EditorState, Extension } from '@codemirror/state';
    import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
    import { config } from 'src/settings';
    import { tags as t } from "@lezer/highlight";
    import { log } from 'src/utils';

    interface RuleEditorProps {
        content: string;
        onChange: (text: string) => void;
    }

    let { content = $bindable(), onChange }: RuleEditorProps = $props();

    const ProfileSwitch = Annotation.define<boolean>();


    let editorContainer: HTMLDivElement;
    let editor: EditorView;

    const obsidianTheme = EditorView.theme({
        "&": {
            color: config.foreground,
            backgroundColor: config.background,
        },
        ".cm-content": { caretColor: config.cursor },
        "&.cm-focused .cm-cursor": { borderLeftColor: config.cursor },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, & ::selection": { backgroundColor: config.selection },
        ".cm-activeLine": { backgroundColor: config.activeLine },
        ".cm-activeLineGutter": { backgroundColor: config.background },
        ".cm-selectionMatch": { backgroundColor: config.selection },
        ".cm-gutters": {
            backgroundColor: config.background,
            color: config.comment,
            borderRight: "1px solid var(--background-modifier-border)"
        },
        ".cm-lineNumbers, .cm-gutterElement": { color: "inherit" },
    });

    const obsidianHighlightStyle = HighlightStyle.define([
        { tag: [t.processingInstruction, t.string, t.inserted, t.special(t.string)], color: config.string },
        { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: config.constant },
        { tag: t.comment, color: config.comment },
        { tag: t.invalid, color: config.invalid },
    ]);

    const extensions: Extension[] = [
        obsidianTheme,
        lineNumbers(),
        EditorView.lineWrapping,
        python(), // it is better to write a language support for rules
        syntaxHighlighting(obsidianHighlightStyle),
        EditorView.updateListener.of(async (v: ViewUpdate) => {
            if (v.docChanged) {
                content = v.state.doc.toString();
                onChange(content)
            }
        })
    ];

  onMount(() => {
    const state = EditorState.create({
      doc: content,
      extensions: extensions
    });

    editor = new EditorView({
      state,
      parent: editorContainer
    });

    log(content)

    log("Editor launched", editor)
  });

  $effect(() => {
    if (editor && content !== editor.state.doc.toString()) {
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: content }
    });
  }})
</script>

<div bind:this={editorContainer} class="rules-editor-wrapper"></div>

<style>
  .rules-editor-wrapper {
    height: 20em;
    resize: vertical;
    overflow: auto;
    font-size: var(--font-inputs);
    border: 1px solid var(--background-modifier-border);
  }
</style>
