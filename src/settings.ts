import { App, PluginSettingTab, Setting, ButtonComponent, ExtraButtonComponent } from "obsidian";
import TypingTransformer from "./main";
import { DEFAULT_RULES } from "./const";
import { EditorState, Extension } from "@codemirror/state";
import { EditorView, ViewUpdate, lineNumbers } from "@codemirror/view";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import { tags as t } from "@lezer/highlight";

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
    ruleEditor: EditorView;

    constructor(app: App, plugin: TypingTransformer) {
        super(app, plugin);
        this.plugin = plugin;
    }

    hide() {
        this.ruleEditor?.destroy();
    }

    display(): void {
        const { containerEl, plugin } = this;
        console.log("display settings");
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
            .setDesc("Enable auto adding spaces etc.")
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
            .setDesc("Enable showing zone indicator's start point as '⭐️'")
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


function createRuleEditorInContainer(container: HTMLElement, plugin: TypingTransformer): EditorView {
    // source: obsidian-latex-suite setting tab, thanks a lot.
    const fragment = document.createDocumentFragment();
    fragment.createEl("span", { text: "Enter conversion, selection, and deletion rules here. NOTES:" }); //line 1
    const ol = fragment.createEl("ol");
    ol.createEl("li", { text: "Each line is one rule. Rules that come first have higher priority." }); //note 1
    ol.createEl("li", { text: "Lines starting with \"#\" will be treated as comments and ignored." }); //note 2

    // TODO: add more desc about escape
  
    const convertRulesSetting = new Setting(container)
        .setName("Rules")
        .setDesc(fragment)
        .setClass("rules-text-area");

    const customCSSWrapper = convertRulesSetting.controlEl.createDiv("rules-editor-wrapper");
    const rulesFooter = convertRulesSetting.controlEl.createDiv("rules-footer");
    const validity = rulesFooter.createDiv("rules-editor-validity");

    const validityIndicator = new ExtraButtonComponent(validity);
    validityIndicator
        .setIcon("checkmark")
        .extraSettingsEl.addClass("rules-editor-validity-indicator");

    const validityText = validity.createDiv("rules-editor-validity-text")
    validityText.classList.add("setting-item-description", "rules-editor-validity-txt");

    function updateValidityIndicator(success: boolean, errs: string[]) {
        validityIndicator.setIcon(success ? "checkmark" : "cross");
        validityIndicator.extraSettingsEl.removeClass(success ? "invalid" : "valid");
        validityIndicator.extraSettingsEl.addClass(success ? "valid" : "invalid");
        const fragment = document.createDocumentFragment();
        for (const err of errs) {
            fragment.createEl("div", { text: err });
        }
        validityText.setText(success ? "Saved" : fragment);
    }

    const extensions: Extension[] = [
        obsidianTheme,
        lineNumbers(),
        EditorView.lineWrapping,
        python(), // it is better to write a language support for rules
        syntaxHighlighting(obsidianHighlightStyle),
        EditorView.updateListener.of(async (v: ViewUpdate) => {
            if (v.docChanged) {
                const value = v.state.doc.toString();
                await feedRules(value);
            }
        })
    ];


    const feedRules = async (newRule: string) => {
        plugin.configureRules(newRule);
        if (plugin.rulesErrs.length != 0) {
            updateValidityIndicator(false, plugin.rulesErrs);
        } else {
            updateValidityIndicator(true, []);
            plugin.settings.convertRules = newRule;
            await plugin.saveSettings();
        }
    };

    const convertRulesEditor = new EditorView({
        state: EditorState.create({ doc: plugin.settings.convertRules, extensions: extensions })
    });
    customCSSWrapper.appendChild(convertRulesEditor.dom);

    const buttonsDiv = rulesFooter.createDiv("rules-editor-buttons");
    const reset = new ButtonComponent(buttonsDiv);
    reset.setIcon("switch")
        .setTooltip("Reset to default rules")
        .onClick(async () => {
            convertRulesEditor.setState(EditorState.create({ doc: DEFAULT_RULES, extensions: extensions }));
            await feedRules(DEFAULT_RULES);
        });
    // reopen settings tab, the line numbers is disaligned with the content, I don't know why...
    // as a workaround, modify the content once to update the display of line numbers
    return convertRulesEditor;
}
