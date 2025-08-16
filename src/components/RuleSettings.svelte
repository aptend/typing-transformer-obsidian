<script lang="ts">
  import TypingTransformer from "src/main";
  // import RuleEditor from "./RuleEditor.svelte";
  import { Notice } from "obsidian";

  let { plugin }: { plugin: TypingTransformer } = $props();

  interface Profile {
      title: string;
      content: string;
  }

  const BaseProfileName = "global";

  // Everything related to Profiles
  //TODO: Don't directly mutate settings 
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
    }

    profiles.push({ title: title, content: "" });
    activeProfile = title;
    newProfilePrompt = false;
    newProfile = "";
  }

  function selectProfile(title: string) {
    activeProfile = title;
  }

  function removeProfile(title: string) {
    if (activeProfile == title) {
      activeProfile = BaseProfileName;
    }
    profiles = profiles.filter(p => p.title !== title);
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
        <div>
          <button
            class:selected={activeProfile === profile.title}
            onclick={() => selectProfile(profile.title)}
          >
            {profile.title}
          </button>
          {#if profile.title !== "global"}
            <button
              class="close"
              onclick={(e) => {
                e.stopPropagation();
                removeProfile(profile.title);
              }}>×</button
            >
          {/if}
        </div>
      {/each}

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
