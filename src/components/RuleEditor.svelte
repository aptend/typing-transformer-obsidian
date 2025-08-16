<script lang="ts">
  import { python } from '@codemirror/lang-python';
  import { lineNumbers, EditorView, ViewUpdate } from '@codemirror/view';
  import { Annotation, EditorState, Extension } from '@codemirror/state';
  import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
  import { config } from 'src/settings';
  import { tags as t } from "@lezer/highlight";
  import { log } from 'src/utils';
  import { onMount } from 'svelte';
  import ObsidianIcon from './ObsidianIcon.svelte';
  import { DEFAULT_RULES } from 'src/const';

  // Props
  interface RuleEditorProps {
    initialText: string;
    checkRules: (text: string) => string[];
    onValidChange: (newText: string) => void;
    isValid: boolean;
  }

  let { initialText, checkRules, onValidChange, isValid = $bindable() } = $props();

  // Editor
  let editorContainer: HTMLDivElement;
  let editor: EditorView;
  let editorText = $state(initialText);

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

  const extensions: Extension[] = [
    obsidianTheme,
    lineNumbers(),
    EditorView.lineWrapping,
    python(), // it is better to write a language support for rules
    syntaxHighlighting(obsidianHighlightStyle),
    EditorView.updateListener.of((v) => handleEditorUpdate(v)),
  ];

  async function handleEditorUpdate(v: ViewUpdate) {
    if (v.docChanged) {
      const newText = v.state.doc.toString();
      editorText = newText;

      validateRuleText(editorText);
    }
  }

  function handleEditorReset() {
    isValid = true;
    validityText = "";
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: DEFAULT_RULES }
    });
  }

  // Valiation
  // isValid is defined from props
  let validityText = $state("");

  async function validateRuleText(newText: string) {
    const errs = await checkRules(newText);
    console.log("Validation errors:", errs)
    if (errs.length > 0) {
      validityText = errs.join('\n');
      isValid = false;
    } else {
      validityText = "Saved";
      isValid = true;
      onValidChange(editorText)
    }
  }

  onMount(() => {
    const state = EditorState.create({
      doc: editorText,
      extensions: extensions
    });

    editor = new EditorView({
      state,
      parent: editorContainer
    });
  });
</script>

<div bind:this={editorContainer} class="rules-editor-wrapper"></div>

<div class="rules-footer">
  <div class="rules-editor-validity">
    <ObsidianIcon className="rules-editor-validity-indicator {isValid ? "valid" : "invalid" }" icon={isValid ? "checkmark" : "x"} />
    <span class="rules-editor-validity-txt" >{validityText}</span>
  </div>
  <div class="rules-editor-buttons">
    <button aria-label="Reset to default rules" onclick={handleEditorReset}>
      <ObsidianIcon icon="repeat" className="" />
    </button>
  </div>
</div>