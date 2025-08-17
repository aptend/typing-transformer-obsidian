import { App, PluginSettingTab, Setting, ButtonComponent, ExtraButtonComponent, Notice, Modal, TextComponent } from "obsidian";
import TypingTransformer from "./main";
import { DEFAULT_RULES } from "./const";
import { Annotation, EditorState, Extension } from "@codemirror/state";
import { EditorView, ViewUpdate, lineNumbers } from "@codemirror/view";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import { tags as t } from "@lezer/highlight";
import { log } from "./utils";
import { mount } from "svelte";
import RuleSettings from "./components/RuleSettings.svelte";

export const config = {
    name: "obsidian",
    dark: false,
    background: "var(--background-primary)",
    foreground: "var(--text-normal)",
    selection: "var(--text-selection)",
    cursor: "var(--text-normal)",
    activeLine: "var(--background-primary)",
    string: "var(--text-accent)",
    constant: "var(--text-accent-hover)",
    comment: "var(--text-faint)",
    invalid: "var(--text-error)",
};

const obsidianHighlightStyle = HighlightStyle.define([
    { tag: [t.processingInstruction, t.string, t.inserted, t.special(t.string)], color: config.string },
    { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: config.constant },
    { tag: t.comment, color: config.comment },
    { tag: t.invalid, color: config.invalid },
]);


const obsidianTheme = EditorView.theme({
    "&": {
        color: config.foreground,
        backgroundColor: config.background,
    },
    ".cm-content": { caretColor: config.cursor },
    "&.cm-focused .cm-cursor": { borderLeftColor: config.cursor },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, & ::selection": { backgroundColor: config.selection },
    ".cm-activeLine": { backgroundColor: config.activeLine },
    ".cm-activeLineGutter": { backgroundColor: config.background },
    ".cm-selectionMatch": { backgroundColor: config.selection },
    ".cm-gutters": {
        backgroundColor: config.background,
        color: config.comment,
        borderRight: "1px solid var(--background-modifier-border)"
    },
    ".cm-lineNumbers, .cm-gutterElement": { color: "inherit" },
});


export const BaseProfileName = "global";
const ProfileSwitch = Annotation.define<boolean>();

export interface TypingTransformerSettings {
    debug: boolean,
    convertRules: string,
    autoFormatOn: boolean,
    zoneIndicatorOn: boolean,
    profiles: Profile[],
    activeProfile: string,
}

interface Profile {
        title: string;
        content: string;
    }


export const DEFAULT_SETTINGS: TypingTransformerSettings = {
    debug: false,
    convertRules: DEFAULT_RULES,
    zoneIndicatorOn: false,
    autoFormatOn: true,
    profiles: [
        { title: BaseProfileName, content: DEFAULT_RULES },
    ],
    activeProfile: BaseProfileName,
};

export class SettingTab extends PluginSettingTab {
    plugin: TypingTransformer;
    ruleEditor: EditorView;
    editorState: State;

    constructor(app: App, plugin: TypingTransformer) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async hide() {
        log("setting: exiting & saving");
        await this.plugin.saveSettings();

        const activeProfile = this.plugin.settings.activeProfile;
        const ruleString = this.plugin.settings.profiles.filter(profile => profile.title === BaseProfileName || profile.title === activeProfile).map(profile => profile.content).join("\n");
        await this.plugin.configureProfile(activeProfile, ruleString);
    }

    display(): void {
        const { containerEl, plugin } = this;
        containerEl.empty();

        containerEl.createEl('h2', {text: 'Typing Transformer Settings'});

        new Setting(containerEl)
            .setName("Debug Log")
            .setDesc("Enable debug log to console.")
            .addToggle(comp => comp
                .setValue(plugin.settings.debug)
                .onChange(async (_val) => await plugin.toggleDebugLog())
            );

        new Setting(containerEl)
            .setName("Auto Format")
            .setDesc("Enable the auto insertion of spaces.")
            .addToggle(comp => comp
                .setValue(plugin.settings.autoFormatOn)
                .onChange(async (_val) => await plugin.toggleAutoFormat())
            );

        new Setting(containerEl)
            .setName("Zone Indicator")
            .setDesc("Enable indication of a zone's start point with '⭐️'")
            .addToggle(comp => comp
                .setValue(plugin.settings.zoneIndicatorOn)
                .onChange(async (_val) => await plugin.toggleIndicator())
            );
        
        mount(RuleSettings, { target: containerEl, props: { plugin: plugin } });
    }
}

export class ConfirmationModal extends Modal {

    constructor(app: App, prompt: string, confirmCb: (ans: boolean) => Promise<void>) {
        super(app);

        this.contentEl.createEl("p", { text: prompt });

        new Setting(this.contentEl)
            .addButton(button => button
                .setButtonText("Confirm")
                .onClick(async () => {
                    await confirmCb(true);
                    this.close();
                })
            )
            .addButton(button => button
                .setButtonText("Cancel")
                .onClick(async () => {
                    await confirmCb(false);
                    this.close();
                })
            );
    }
}