<script lang="ts">
    export let icon: string;

    const iconMap = new Map<string, string>([
        ["checkmark", `<svg viewBox="0 0 100 100" class="checkmark" width="16" height="16"><path fill="currentColor" stroke="currentColor" d="M85.8,17.3c-0.1,0-0.1,0-0.2,0.1c-0.5,0.1-1,0.5-1.3,0.9L43.4,81.6L15.3,56.2c-0.5-0.6-1.3-0.9-2.1-0.7 c-0.8,0.2-1.3,0.9-1.5,1.6c-0.1,0.8,0.2,1.6,0.9,2l29.8,27c0.4,0.4,1,0.6,1.6,0.5c0.6-0.1,1.1-0.4,1.4-0.9l42.2-65.4 c0.5-0.7,0.5-1.5,0.1-2.2S86.5,17.1,85.8,17.3L85.8,17.3z"></path></svg>`],
        ["cross", `<svg viewBox="0 0 100 100" class="cross" width="16" height="16"><path fill="currentColor" stroke="currentColor" d="M15.4,12.6l-2.9,2.9L47.1,50L12.6,84.6l2.9,2.9L50,52.9l34.6,34.6l2.9-2.9L52.9,50l34.6-34.6l-2.9-2.9L50,47.1L15.4,12.6z "></path></svg>`],
    ]) 
</script>

{@html iconMap.get(icon)}