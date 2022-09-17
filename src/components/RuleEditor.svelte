<script lang="ts">
  import { Annotation, type Extension } from "@codemirror/state";
  import { EditorView, ViewUpdate, lineNumbers } from "@codemirror/view";
  import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
  import { python } from "@codemirror/lang-python";
  import InnerEditor from "./InnerEditor.svelte";
  import ValidityIndicator from "./ValidityIndicator.svelte";
  import type TypingTransformer from "../main";
  import { obsidianHighlightStyle, obsidianTheme } from "./editorStores"

  // use context?
  export let plugin: TypingTransformer;

  let errors: string[] = null;
  let cm: InnerEditor;

  export const BaseProfileName = "global";
  const ProfileSwitch = Annotation.define<boolean>();

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
