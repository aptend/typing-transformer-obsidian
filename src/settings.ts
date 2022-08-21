import { App, PluginSettingTab, Setting } from "obsidian";
import TypingTransformer from "./main";
import { DEFAULT_RULES } from "./const";
import { Extension } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import { tags as t } from "@lezer/highlight";

import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import { Editor } from "./components/editor";


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


export interface TypingTransformerSettings {
    debug: boolean,
    convertRules: string,
    autoFormatOn: boolean,
    zoneIndicatorOn: boolean,
}

export const DEFAULT_SETTINGS: TypingTransformerSettings = {
    debug: false,
    convertRules: DEFAULT_RULES,
    zoneIndicatorOn: true,
    autoFormatOn: true,
};

export class SettingTab extends PluginSettingTab {
    plugin: TypingTransformer;
    ruleEditor: Root;

    constructor(app: App, plugin: TypingTransformer) {
        super(app, plugin);
        this.plugin = plugin;
    }

    hide() {
        this.ruleEditor.unmount();
    }

    display(): void {
        const { containerEl, plugin } = this;
        containerEl.empty();

        // new Setting(containerEl)
        // 	.setName("Debug")
        // 	.setDesc("Print more logs to the console")
        // 	.addToggle(comp => comp
        // 		.setValue(plugin.settings.debug)
        // 		.onChange(async (value) => {
        // 			plugin.settings.debug = value;
        // 			await plugin.saveSettings();
        // 		})
        // 	)

        new Setting(containerEl)
            .setName("Auto Format")
            .setDesc("Enable the auto insertion of spaces.")
            .addToggle(comp => comp
                .setValue(plugin.settings.autoFormatOn)
                .onChange(async (value) => {
                    plugin.settings.autoFormatOn = value;
                    await plugin.saveSettings();
                    plugin.configureActiveExtsFromSettings();
                    plugin.app.workspace.updateOptions();
                })
            );

        new Setting(containerEl)
            .setName("Zone Indicator")
            .setDesc("Enable indication of a zone's start point with '⭐️'")
            .addToggle(comp => comp
                .setValue(plugin.settings.zoneIndicatorOn)
                .onChange(async (value) => {
                    plugin.settings.zoneIndicatorOn = value;
                    await plugin.saveSettings();
                    plugin.configureActiveExtsFromSettings();
                    plugin.app.workspace.updateOptions();
                })
            );

        this.ruleEditor = createRuleEditorInContainer(containerEl, plugin);
    }
}


function createRuleEditorInContainer(container: HTMLElement, plugin: TypingTransformer): Root {
    // source: obsidian-latex-suite setting tab, thanks a lot.
    const fragment = document.createDocumentFragment();
    fragment.createEl("span", { text: "Enter conversion, selection, and deletion rules here. NOTES:" }); //line 1
    const ol = fragment.createEl("ol");
    ol.createEl("li", { text: "Each line is one rule. Rules that come first have higher priority." }); //note 1
    ol.createEl("li", { text: "Lines starting with \"#\" are treated as comments and ignored. Inline comments are also allowed" }); //note 2
    ol.createEl("li", { text: "Certain characters ' | \\ must be escaped with backslashes \\."}); //note 3

    const convertRulesSetting = new Setting(container)
        .setName("Rules")
        .setDesc(fragment)
        .setClass("rules-text-area");

    const root = createRoot(convertRulesSetting.controlEl);

    const extensions: Extension[] = [
        obsidianTheme,
        lineNumbers(),
        EditorView.lineWrapping,
        python(), // it is better to write a language support for rules
        syntaxHighlighting(obsidianHighlightStyle),
    ];
    root.render(Editor({
        text: plugin.settings.convertRules,
        resetText: DEFAULT_RULES,
        checkOnUpdate: plugin.configureRules,
        extensions: extensions,
    }));
    
    return root;
}
