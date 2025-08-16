<script lang="ts">
    import { setIcon } from "obsidian";

    let { isValid, validityText, ruleEditorText } = $props();

    let validityIconEl: HTMLElement;

    $effect(() => {
        if (validityIconEl) setIcon(validityIconEl, isValid ? "checkmark" : "x");
    })

    async function validateRules(newText: string) {
        const errs = await plugin.checkRules(newText);
        console.log("Validation errors:", errs)
        if (errs.length > 0) {
            validityText = errs.join('\n');
            isValid = false;
        } else {
            validityText = "Saved";
            isValid = true;
        }
    }
</script>

<div class="rules-editor-validity">
    <div class="rules-editor-validity-indicator {isValid ? "valid" : "invalid" }" bind:this={validityIconEl}></div>
    <span class="rules-editor-validity-txt" >{validityText}</span>
</div>
