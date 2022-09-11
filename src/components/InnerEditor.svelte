 <!-- wrap a code mirror editor in a Svelte component  -->

<script lang="ts">
  import { Annotation, EditorState, type Extension } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";

  export let initContent: string;
  export let initExts: Extension[];

  let editorView: EditorView;

  export function setEditorContent(text: string, annos: Annotation<any>[]) {
    editorView.dispatch({
      changes: { from: 0, to: editorView.state.doc.length, insert: text },
      annotations: annos,
    });
  }

  // an action to set up a code mirror view
  function cm_editor(
    container: HTMLElement,
    args: { content: string; exts: Extension[] }
  ) {
    editorView = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: args.content,
        extensions: args.exts,
      }),
    });

    return {
      destroy() {
        editorView.destroy();
      },
    };
  }
</script>

<div
  class="rules-editor-wrapper"
  use:cm_editor={{ content: initContent, exts: initExts }}
/>
