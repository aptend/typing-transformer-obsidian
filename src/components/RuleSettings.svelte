<script lang="ts">
  import TypingTransformer from "src/main";
  import RuleEditor from "./RuleEditor.svelte";
  import { Notice } from "obsidian";
  import { ConfirmationModal } from "src/settings";

  let { plugin }: { plugin: TypingTransformer } = $props();

  interface Profile {
      title: string;
      content: string;
  }

  const BaseProfileName = "global";

  // Everything related to Profiles
  let activeProfile = $state(plugin.settings.activeProfile);
  let profiles: Profile[] = $state(plugin.settings.profiles);

  // States to Handle New Profile Creation
  let newProfilePrompt = $state(false);
  let newProfile = $state("");

  function addProfile(title: string) {
    if (profiles.length > 5) {
        new Notice("You can only have 6 profiles at most.");
        return;
    }

    if (profiles.some(p => p.title === title)) {
        new Notice("Profile already exists!", 5000)
        return;
    }

    profiles.push({ title: title, content: "" });
    activeProfile = title;
    newProfilePrompt = false;
    newProfile = "";
    saveSettings();
  }

  function selectProfile(title: string) {
    console.log("selected profile:", title)
    changeActiveProfile(title);
    saveSettings();
  }

  function removeProfile(title: string) {
    if (activeProfile == title) {
      activeProfile = BaseProfileName;
    }
    profiles = profiles.filter(p => p.title !== title);
    saveSettings();
  } 

  // TODO: function changeActiveProfile
  // Bind state of editor (for checking when selecting profiles)
  let editorIsValid = $state(true);

  // Bind editor element, so we can access the exported function (to change text within)
  let ruleEditorRef: RuleEditor;

  // Function will not only update variable, but also run something to update the Rule Editor
  async function changeActiveProfile(title: string) {
    if (!editorIsValid) {
      const confirmed = await new Promise<boolean>((resolve) => {
        new ConfirmationModal(
        plugin.app,
        "Are you sure you want to discard changes?",
        async (ans: boolean) => resolve(ans),
        ).open();
      });

      if (!confirmed) return;
    }

    activeProfile = title;
    editorIsValid = true;

    const newProfile = profiles.find(p => p.title === activeProfile);
    if (newProfile) {
      ruleEditorRef.handleEditorReset(newProfile.content);
    }
  }

  async function saveSettings() {
    plugin.settings.profiles = profiles;
    plugin.settings.activeProfile = activeProfile;
    plugin.saveSettings().catch((e) => {
      new Notice("Failed to save plugin settings");
      console.error(e);
    });
  }

  // Handle Content from Rule Editor
  function handleValidChange(newText: string) {
    const profile = profiles.find(p => p.title === activeProfile);
    if (profile) profile.content = newText;
    saveSettings();
  }
</script>

<div class="setting-item rules-text-area">
  <div class="setting-item-info">
    <div class="setting-item-name">Rules</div>
    <div class="setting-item-description">
      <span>Enter conversion, selection, and deletion rules here. NOTES:</span>
      <ol>
        <li>
          Each line is one rule. Rules that come first have higher priority.
        </li>
        <li>
          Lines starting with "#" are treated as comments and ignored. Inline
          comments are also allowed
        </li>
        <li>
          The character '|' indicates where your cursor will be placed after the
          rule is applied.
        </li>
        <li>
          To use special characters like '|' for conversion, you escape them
          with a backslash, for example: '\|'
        </li>
        <li>
          Whatever tab you are on when the plugin settings tab quits will be the
          profile that is chosen
        </li>
        <li>The 'global' profile will always be active</li>
      </ol>
    </div>
  </div>
  <div class="setting-item-control">
    <div class="rules-profiles">
      {#each profiles as profile (profile.title)}
        <div class="rules-profile-container clickable-icon extra-setting-button" class:selected={activeProfile === profile.title}>
          <button onclick={() => selectProfile(profile.title)}>
            {profile.title}
          </button>
          {#if profile.title !== "global"}
            <button
              class="rules-profile-close"
              onclick={(e) => {
                e.stopPropagation();
                removeProfile(profile.title);
              }}>×</button
            >
          {/if}
        </div>
      {/each}
      
      <div class="rules-profile-container clickable-icon extra-setting-button">
        {#if newProfilePrompt}
          <input
            type="text"
            bind:value={newProfile}
            placeholder="Enter profile name"
            onkeydown={(e) => {
              if (e.key === "Enter") addProfile(newProfile);
            }}
          />
          <button onclick={() => addProfile(newProfile)}>✔️</button>
          <button onclick={() => (newProfilePrompt = false)}>❌</button>
        {:else}
          <button onclick={() => (newProfilePrompt = true)}>+</button>
        {/if}
      </div>
    </div>
  </div>
</div>

<RuleEditor bind:this={ruleEditorRef} initialText={profiles.filter(profile => profile.title == activeProfile)[0].content} checkRules={plugin.checkRules} onValidChange={handleValidChange} bind:isValid={editorIsValid}  />