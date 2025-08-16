<script lang="ts">

    //Define props
    import TypingTransformer from "src/main";
    import RuleEditor from "./RuleEditor.svelte";


    let { plugin }: { plugin: TypingTransformer } = $props();

    const BaseProfileName = "global";

    // State Variables
    let activeProfile = $state(plugin.settings.activeProfile);
    let profiles: Profile[] = $state(plugin.settings.profiles);


    // Process Rule Editor Text
    let activeProfileContent = $derived(profiles.filter(profile => profile.title == activeProfile)[0].content);
    // svelte-ignore state_referenced_locally
    let ruleEditorText = $state(activeProfileContent);

    function saveProfileContent() {
        
    }
    
    // Check Validity
    import { setIcon } from "obsidian";

    let validityText = $state("");
    let validityIconEl: HTMLElement;
    let isValid = $state(true);

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

    //Profile Actions
    import { Notice } from "obsidian";
    import { log } from "src/utils";
    import { EditorView } from "@codemirror/view";

    interface Profile {
        title: string;
        content: string;
    }

    let newProfilePromptDisplay = $state(false);
    let newProfileName = $state("");

    function handleAddProfile(profileTitle: string): void {
        if (profiles.length > 5) {
            new Notice("You can only have 6 profiles at most.");
            return;
        }

        if (profiles.some(p => p.title === profileTitle)) {
            new Notice("Profile already exists!", 5000)
        }

        profiles.push({ title: profileTitle, content: "" });
        activeProfile = profileTitle;
        newProfilePromptDisplay = false;
    }

    function selectProfile(profileTitle: string): void {
        activeProfile = profileTitle;
        ruleEditorText = activeProfileContent;
        log(activeProfile)
        log(ruleEditorText)
    }
    
    function removeProfile(profileTitle: string): void {
        if (activeProfile == profileTitle) {
            activeProfile = BaseProfileName;
        }
        profiles = profiles.filter(p => p.title !== profileTitle);
    }

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
            {#each profiles as profile (profile.title)}
                <div>
                    <button
                        class:selected={activeProfile === profile.title}
                        onclick={() => selectProfile(profile.title)}
                    >
                    {profile.title}
                    </button>
                    {#if profile.title !== "global"}
                        <button class="close" onclick={(e) => { 
                            e.stopPropagation(); 
                            removeProfile(profile.title);
                        }}>×</button>
                    {/if}
                    </div>
            {/each}
            
            {#if newProfilePromptDisplay} 
                <input 
                    type="text"
                    bind:value={newProfileName}
                    placeholder="Enter profile name"
                    onkeydown={(e) => {
                        if (e.key === "Enter") handleAddProfile(newProfileName);
                    }}
                />
                <button onclick={() => handleAddProfile(newProfileName)}>✔️</button>
                <button onclick={() => newProfilePromptDisplay = false}>❌</button>
            {:else}
                <button onclick={() => newProfilePromptDisplay = true}>+</button>
            {/if}  
        </div>
    </div>

    <RuleEditor bind:content={ruleEditorText} onChange={validateRules} />

    <div class="rules-footer">
        <div class="rules-editor-validity">
            <div class="rules-editor-validity-indicator {isValid ? "valid" : "invalid" }" bind:this={validityIconEl}></div>
            <span class="rules-editor-validity-txt" >{validityText}</span>
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
