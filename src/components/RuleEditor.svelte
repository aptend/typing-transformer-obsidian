<script lang="ts">
    import TypingTransformer from "src/main";
    import type { State } from "src/settings";

    type RuleEditorProps = {
        plugin: TypingTransformer,
        state: State;
    }

    let props: RuleEditorProps = $props();

</script>

<div class="setting-item rules-text-area">
   <div class="setting-item-info">
      <div class="setting-item-name">Rules</div>
      <div class="setting-item-description">
         <span>Enter conversion, selection, and deletion rules here. NOTES:</span>
         <ol>
            <li>Each line is one rule. Rules that come first have higher priority.</li>
            <li>Lines starting with "#" are treated as comments and ignored. Inline comments are also allowed</li>
            <li>The character '|' indicates where your cursor will be placed after the rule is applied.</li>
            <li>To use special characters like '|' for conversion, you escape them with a backslash, for example: '\|' </li>
            <li>Whatever tab you are on when the plugin settings tab quits will be the profile that is chosen</li>
            <li>The 'global' profile will always be active</li>
         </ol>
      </div>
   </div>
   <div class="setting-item-control">
      <div class="rules-profiles">
         <div class="clickable-icon extra-setting-button rules-profile-button selected" accesskey="global">global</div>
         <div class="clickable-icon extra-setting-button rules-profile-button">+</div>
      </div>
      <div class="rules-editor-wrapper">
         <div class="cm-editor ͼ1 ͼ2 ͼ23">
            <div class="cm-announced" aria-live="polite"></div>
            <div tabindex="-1" class="cm-scroller">
               <div class="cm-gutters cm-gutters-before" aria-hidden="true" style="min-height: 743px; position: sticky;">
                  <div class="cm-gutter cm-lineNumbers">
                     <!-- line numbers -->
                  </div>
               </div>
               <div spellcheck="false" autocorrect="off" autocapitalize="off" writingsuggestions="false" translate="no" contenteditable="true" class="cm-content cm-lineWrapping" role="textbox" aria-multiline="true" data-language="python" style="tab-size: 4;">
                  <!-- contents -->
               </div>
            </div>
         </div>
      </div>
      <div class="rules-footer">
         <div class="rules-editor-validity">
            <div class="clickable-icon extra-setting-button rules-editor-validity-indicator"></div>
            <div class="rules-editor-validity-text setting-item-description rules-editor-validity-txt"></div>
         </div>
         <div class="rules-editor-buttons">
            <button aria-label="Reset to default rules">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-repeat">
                  <path d="m17 2 4 4-4 4"></path>
                  <path d="M3 11v-1a4 4 0 0 1 4-4h14"></path>
                  <path d="m7 22-4-4 4-4"></path>
                  <path d="M21 13v1a4 4 0 0 1-4 4H3"></path>
               </svg>
            </button>
         </div>
      </div>
   </div>
</div>
