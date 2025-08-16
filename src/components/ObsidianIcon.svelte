<script lang="ts">
	import { onMount } from 'svelte';
	import { setIcon } from 'obsidian';

	export let icon: string;
	export let className: string = '';

	let el: HTMLElement;

	$: if (el && icon) setIcon(el, icon);
</script>

<span bind:this={el} class={className}></span>