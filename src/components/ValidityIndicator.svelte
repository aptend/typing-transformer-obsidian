<script lang="ts">
  import ObsidianIcon from "./ObsidianIcon.svelte";

  export let errors: string[] = null;
  $: valid = errors?.length === 0;
</script>

{#if errors != null}
  <div class:valid class="rules-editor-validity">
    <div
      class:valid
      class:invalid={!valid}
      class="rules-editor-validity-indicator"
    >
      <ObsidianIcon icon={valid ? "checkmark" : "cross"} />
    </div>

    <div class="setting-item-description rules-editor-validity-txt">
      {#if valid}
        Saved!
      {:else}
        {#each errors as err}
          <div>{err}</div>
        {/each}
      {/if}
    </div>
  </div>
{/if}
