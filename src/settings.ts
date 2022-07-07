import { App, PluginSettingTab, Setting, ButtonComponent, ExtraButtonComponent } from "obsidian";
import TypingTransformer  from "./main";
import { DEFAULT_RULES } from "./const";
import { EditorState, Extension } from "@codemirror/state";
import { EditorView, ViewUpdate } from "@codemirror/view";


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

    constructor(app: App, plugin: TypingTransformer) {
        super(app, plugin);
        this.plugin = plugin;
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
        
        // source: obsidian-latex-suite setting tab
        const convertRulesSetting = new Setting(containerEl)
            .setName("Converting rules")
            .setDesc("Enter converting rules here. Each line is one rule and rules that come first \
                      have higher priority. Lines starting with \"#\" will be treated as comments and ignored.")
            .setClass("rules-text-area");


        const customCSSWrapper = convertRulesSetting.controlEl.createDiv("rules-editor-wrapper");
        const rulesFooter = convertRulesSetting.controlEl.createDiv("rules-footer");
        const validity = rulesFooter.createDiv("rules-editor-validity");

        const validityIndicator = new ExtraButtonComponent(validity);
        validityIndicator
            .setIcon("checkmark")
            .extraSettingsEl.addClass("rules-editor-validity-indicator");

        const validityText = validity.createDiv("rules-editor-validity-text");
        validityText.addClass("setting-item-description");
        validityText.addClass("rules-editor-validity-txt");

        function updateValidityIndicator(success: boolean, err: string) {
            validityIndicator.setIcon(success ? "checkmark" : "cross");
            validityIndicator.extraSettingsEl.removeClass(success ? "invalid" : "valid");
            validityIndicator.extraSettingsEl.addClass(success ? "valid" : "invalid");
            validityText.setText("");
            validityText.setText(success ? "Saved" : err);
        }

        const extensions: Extension[] = [];

        const change = EditorView.updateListener.of(async (v: ViewUpdate) => {
            if (v.docChanged) {
                const value = v.state.doc.toString();
                await feedRules(value);
            }
        });

        extensions.push(change);

        const feedRules = async (newRule: string) => {
            plugin.configureRules(newRule);
            if (plugin.rulesErr != "") {
                updateValidityIndicator(false, plugin.rulesErr);
            } else {
                updateValidityIndicator(true, "");
                plugin.settings.convertRules = newRule;
                await this.plugin.saveSettings();
            }
        };

        const convertRulesEditor = new EditorView({
            state: EditorState.create({doc: plugin.settings.convertRules, extensions})
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

    }
}
