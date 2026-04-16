import { App, PluginSettingTab, Setting } from "obsidian";
import TypingTransformer from "./main";
import { DEFAULT_RULES } from "./const";
import { log } from "./utils";
import RulesEditor from "./RulesEditor.svelte";

export const BaseProfileName = "global";

interface Profile {
    title: string;
    content: string;
}

export interface TypingTransformerSettings {
    debug: boolean,
    convertRules: string,
    autoFormatOn: boolean,
    zoneIndicatorOn: boolean,
    profiles: Profile[],
    activeProfiles: string[],
}

export const DEFAULT_SETTINGS: TypingTransformerSettings = {
    debug: false,
    convertRules: DEFAULT_RULES,
    zoneIndicatorOn: false,
    autoFormatOn: true,
    profiles: [
        { title: BaseProfileName, content: DEFAULT_RULES },
    ],
    activeProfiles: [BaseProfileName],
};

interface RulesEditorInstance {
    getState(): {
        selectedProfileName: string;
        profilesMap: Map<string, string>;
        editedProfile: Set<string>;
        activeProfiles: Set<string>;
    };
    $destroy(): void;
}

export class SettingTab extends PluginSettingTab {
    plugin: TypingTransformer;
    rulesEditor: RulesEditorInstance | null = null;

    constructor(app: App, plugin: TypingTransformer) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async hide() {
        if (!this.rulesEditor) return;
        const { profilesMap: map, editedProfile: set, activeProfiles } = this.rulesEditor.getState();
        this.rulesEditor.$destroy();
        this.rulesEditor = null;

        if (set.size > 0) {
            const newProfiles: Profile[] = [];
            for (const [key, value] of map) {
                newProfiles.push({ title: key, content: value });
            }
            this.plugin.settings.profiles = newProfiles;
            log("setting: save profiles");
            await this.plugin.saveSettings();
        }

        const currentActiveProfiles = this.plugin.settings.activeProfiles;
        const activeProfilesChanged =
            activeProfiles.size !== currentActiveProfiles.length ||
            !currentActiveProfiles.every(p => activeProfiles.has(p));

        if (set.size > 0 || activeProfilesChanged) {
            const globalContent = map.get(BaseProfileName) ?? "";
            const otherContent = Array.from(activeProfiles)
                .filter(p => p !== BaseProfileName)
                .map(p => map.get(p) ?? "")
                .filter(c => c)
                .join('\n');
            const newRule = otherContent ? globalContent + '\n' + otherContent : globalContent;
            await this.plugin.configureProfiles(Array.from(activeProfiles), newRule);
        }
    }

    display(): void {
        const { containerEl, plugin } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Typing Transformer Settings' });

        new Setting(containerEl)
            .setName("Debug Log")
            .setDesc("Enable debug log to console.")
            .addToggle(comp => comp
                .setValue(plugin.settings.debug)
                .onChange(async () => await plugin.toggleDebugLog())
            );

        new Setting(containerEl)
            .setName("Auto Format")
            .setDesc("Enable the auto insertion of spaces.")
            .addToggle(comp => comp
                .setValue(plugin.settings.autoFormatOn)
                .onChange(async () => await plugin.toggleAutoFormat())
            );

        new Setting(containerEl)
            .setName("Zone Indicator")
            .setDesc("Enable indication of a zone's start point with '⭐️'")
            .addToggle(comp => comp
                .setValue(plugin.settings.zoneIndicatorOn)
                .onChange(async () => await plugin.toggleIndicator())
            );

        const fragment = document.createDocumentFragment();
        fragment.createEl("span", { text: "Enter conversion, selection, and deletion rules here. NOTES:" });
        const ol = fragment.createEl("ol");
        ol.createEl("li", { text: "Each line is one rule. Rules that come first have higher priority." });
        ol.createEl("li", { text: "Lines starting with \"#\" are treated as comments and ignored. Inline comments are also allowed" });
        ol.createEl("li", { text: "The character '|' indicates where your cursor will be placed after the rule is applied." });
        ol.createEl("li", { text: "To use special characters like '|' for conversion, you escape them with a backslash, for example: '\\|'" });
        ol.createEl("li", { text: "Whatever tab you are on when the plugin settings tab quits will be the profile that is chosen" });
        ol.createEl("li", { text: "The 'global' profile will always be active" });

        const rulesSetting = new Setting(containerEl)
            .setName("Rules")
            .setDesc(fragment)
            .setClass("rules-text-area");

        this.rulesEditor = new RulesEditor({
            target: rulesSetting.controlEl,
            props: { plugin },
        }) as unknown as RulesEditorInstance;
    }
}
