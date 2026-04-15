<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { Notice, setIcon } from "obsidian";
    import type TypingTransformer from "./main";
    import { DEFAULT_RULES } from "./const";
    import { BaseProfileName } from "./settings";
    import { StringInputModal, ConfirmationModal } from "./modals";
    import { Annotation, EditorState, type Extension } from "@codemirror/state";
    import { EditorView, type ViewUpdate, lineNumbers } from "@codemirror/view";
    import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
    import { python } from "@codemirror/lang-python";
    import { tags as t } from "@lezer/highlight";

    export let plugin: TypingTransformer;

    // ── CodeMirror theme ────────────────────────────────────────────────────
    const obsidianHighlightStyle = HighlightStyle.define([
        { tag: [t.processingInstruction, t.string, t.inserted, t.special(t.string)], color: "var(--text-accent)" },
        { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "var(--text-accent-hover)" },
        { tag: t.comment, color: "var(--text-faint)" },
        { tag: t.invalid, color: "var(--text-error)" },
    ]);

    const obsidianTheme = EditorView.theme({
        "&": { color: "var(--text-normal)", backgroundColor: "var(--background-primary)" },
        ".cm-content": { caretColor: "var(--text-normal)" },
        "&.cm-focused .cm-cursor": { borderLeftColor: "var(--text-normal)" },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, & ::selection": { backgroundColor: "var(--text-selection)" },
        ".cm-activeLine": { backgroundColor: "var(--background-primary)" },
        ".cm-activeLineGutter": { backgroundColor: "var(--background-primary)" },
        ".cm-selectionMatch": { backgroundColor: "var(--text-selection)" },
        ".cm-gutters": {
            backgroundColor: "var(--background-primary)",
            color: "var(--text-faint)",
            borderRight: "1px solid var(--background-modifier-border)",
        },
        ".cm-lineNumbers, .cm-gutterElement": { color: "inherit" },
    });

    // ── State ────────────────────────────────────────────────────────────────
    let selectedProfileName: string = plugin.settings.activeProfile;
    let profilesMap: Map<string, string> = new Map(
        plugin.settings.profiles.map(p => [p.title, p.content])
    );
    let editedProfile: Set<string> = new Set();

    // null = unchecked, true = valid, false = invalid
    let isValid: boolean | null = null;
    let validityErrors: string[] = [];

    // ── DOM refs ─────────────────────────────────────────────────────────────
    let editorContainer: HTMLElement;
    let validityIconEl: HTMLElement;
    let editor: EditorView;

    // ── Reactive derived ─────────────────────────────────────────────────────
    $: profileNames = Array.from(profilesMap.keys());

    $: if (validityIconEl) {
        if (isValid === null) {
            setIcon(validityIconEl, "");
            validityIconEl.classList.remove("valid", "invalid");
        } else if (isValid) {
            setIcon(validityIconEl, "checkmark");
            validityIconEl.classList.remove("invalid");
            validityIconEl.classList.add("valid");
        } else {
            setIcon(validityIconEl, "cross");
            validityIconEl.classList.remove("valid");
            validityIconEl.classList.add("invalid");
        }
    }

    // ── Validity helpers ─────────────────────────────────────────────────────
    function resetValidity() {
        isValid = null;
        validityErrors = [];
    }

    async function tryResetValidity(): Promise<boolean> {
        if (isValid === false) {
            return new Promise((resolve) => {
                new ConfirmationModal(
                    plugin.app,
                    "Are you sure you want to discard changes?",
                    async (ans: boolean) => {
                        if (ans) resetValidity();
                        resolve(ans);
                    }
                ).open();
            });
        }
        resetValidity();
        return true;
    }

    // ── Editor helpers ───────────────────────────────────────────────────────
    const ProfileSwitch = Annotation.define<boolean>();

    function setEditorContent(text: string) {
        editor.dispatch({
            changes: { from: 0, to: editor.state.doc.length, insert: text },
            annotations: ProfileSwitch.of(true),
        });
    }

    async function feedRules(newRule: string) {
        const errs = await plugin.checkRules(newRule);
        if (errs.length !== 0) {
            isValid = false;
            validityErrors = errs;
        } else {
            isValid = true;
            validityErrors = [];
            profilesMap.set(selectedProfileName, newRule);
            profilesMap = profilesMap;
            editedProfile.add(selectedProfileName);
            editedProfile = editedProfile;
        }
    }

    // ── Profile management ───────────────────────────────────────────────────
    async function onProfileClick(name: string) {
        if (!await tryResetValidity()) return;
        selectedProfileName = name;
        setEditorContent(profilesMap.get(name) ?? "");
    }

    async function onRemoveProfile(name: string) {
        if (name === selectedProfileName) {
            await onProfileClick(BaseProfileName);
        }
        profilesMap.delete(name);
        profilesMap = profilesMap;
        editedProfile.add(name);
        editedProfile = editedProfile;
    }

    function openAddProfileModal() {
        if (profilesMap.size > 5) {
            new Notice("You can only have 6 profiles at most.");
            return;
        }
        new StringInputModal(plugin.app, (value: string): boolean => {
            if (profilesMap.has(value)) return false;
            if (value === undefined || value === "") return true;
            profilesMap.set(value, "");
            profilesMap = profilesMap;
            editedProfile.add(value);
            editedProfile = editedProfile;
            onProfileClick(value);
            return true;
        }).open();
    }

    async function resetToDefault() {
        const extensions = buildExtensions();
        editor.setState(EditorState.create({ doc: DEFAULT_RULES, extensions }));
        await feedRules(DEFAULT_RULES);
    }

    // ── Expose state for SettingTab.hide() ───────────────────────────────────
    export function getState() {
        return { selectedProfileName, profilesMap, editedProfile };
    }

    // ── CodeMirror setup ─────────────────────────────────────────────────────
    function buildExtensions(): Extension[] {
        return [
            obsidianTheme,
            lineNumbers(),
            EditorView.lineWrapping,
            python(),
            syntaxHighlighting(obsidianHighlightStyle),
            EditorView.updateListener.of(async (v: ViewUpdate) => {
                if (!v.docChanged) return;
                const isProfileSwitch = v.transactions.some(tr => tr.annotation(ProfileSwitch));
                if (isProfileSwitch) return;
                await feedRules(v.state.doc.toString());
            }),
        ];
    }

    // ── Svelte action: set Obsidian icon on an element ───────────────────────
    function obsidianIcon(el: HTMLElement, iconId: string) {
        setIcon(el, iconId);
        return {
            update(newId: string) { setIcon(el, newId); }
        };
    }

    onMount(() => {
        const initialContent = profilesMap.get(selectedProfileName) ?? "";
        editor = new EditorView({
            state: EditorState.create({ doc: initialContent, extensions: buildExtensions() }),
        });
        editorContainer.appendChild(editor.dom);
    });

    onDestroy(() => {
        editor?.destroy();
    });
</script>

<!-- Profile tabs -->
<div class="rules-profiles">
    {#each profileNames as name (name)}
        <div
            class="rules-profile-button"
            class:selected={name === selectedProfileName}
            on:click={() => onProfileClick(name)}
            role="tab"
            tabindex="0"
            on:keydown={e => e.key === "Enter" && onProfileClick(name)}
        >
            {name}
            {#if name !== BaseProfileName}
                <span
                    class="rules-profile-close"
                    use:obsidianIcon={"cross"}
                    on:click|stopPropagation={() => onRemoveProfile(name)}
                    role="button"
                    tabindex="0"
                    on:keydown|stopPropagation={e => e.key === "Enter" && onRemoveProfile(name)}
                ></span>
            {/if}
        </div>
    {/each}
    <div
        class="rules-profile-button"
        on:click={openAddProfileModal}
        role="button"
        tabindex="0"
        on:keydown={e => e.key === "Enter" && openAddProfileModal()}
    >+</div>
</div>

<!-- CodeMirror editor -->
<div class="rules-editor-wrapper" bind:this={editorContainer}></div>

<!-- Footer -->
<div class="rules-footer">
    <div class="rules-editor-validity">
        <span
            class="rules-editor-validity-indicator"
            bind:this={validityIconEl}
        ></span>
        <div class="rules-editor-validity-text setting-item-description rules-editor-validity-txt">
            {#if isValid === true}
                Saved
            {:else if isValid === false}
                {#each validityErrors as err}
                    <div>{err}</div>
                {/each}
            {/if}
        </div>
    </div>
    <div class="rules-editor-buttons">
        <button
            class="clickable-icon"
            aria-label="Reset to default rules"
            on:click={resetToDefault}
            use:obsidianIcon={"switch"}
        ></button>
    </div>
</div>
