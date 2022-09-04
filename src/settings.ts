import { App, PluginSettingTab, Setting, ButtonComponent, ExtraButtonComponent, Notice, Modal } from "obsidian";
import TypingTransformer from "./main";
import { DEFAULT_RULES } from "./const";
import { Annotation, EditorState, Extension } from "@codemirror/state";
import { EditorView, ViewUpdate, lineNumbers } from "@codemirror/view";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import { tags as t } from "@lezer/highlight";
import { log } from "./utils";

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
    activeProfile: string,
}

export const DEFAULT_SETTINGS: TypingTransformerSettings = {
    debug: false,
    convertRules: DEFAULT_RULES,
    zoneIndicatorOn: true,
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
        this.editorState = {
            selectedProfileName: BaseProfileName,
            selectedProfileEl: undefined,
            baseProfileEl: undefined,
            profilesMap: new Map<string, string>(plugin.settings.profiles.map((p) => {
                return [p.title, p.content];
            })),
            editedProfile: new Set<string>()
        };
    }

    async hide() {
        this.ruleEditor?.destroy();
        const s = this.editorState;
        if (s.editedProfile.size > 0) {
            const newProfiles: Profile[] = [];
            for (const [key, value] of s.profilesMap) {
                newProfiles.push({ title: key, content: value });
            }
            this.plugin.settings.profiles = newProfiles;
            log("setting: save profiles");
            await this.plugin.saveSettings();
        }
    }

    display(): void {
        const { containerEl, plugin } = this;
        containerEl.empty();

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

        let onProfileFallback: () => void;
        new Setting(containerEl)
            .setName("Profile")
            .setDesc("Select the active profile. NOTE: The 'global' profile will always be active.")
            .addDropdown((dropdown) => {
                const refreshOptions = () => {
                    dropdown.selectEl.innerHTML = '';
                    for (const title of this.editorState.profilesMap.keys()) {
                        dropdown.addOption(title, title);
                    }
                    dropdown.setValue(this.plugin.settings.activeProfile);
                };
                dropdown.selectEl.onClickEvent((ev) => {
                    if (ev.targetNode != dropdown.selectEl) return;
                    refreshOptions();
                });
                refreshOptions();
                onProfileFallback = () => { dropdown.setValue(BaseProfileName); }
                dropdown.onChange(async (value) => {
                    const map = this.editorState.profilesMap;
                    const newRule = value === BaseProfileName ?
                        map.get(BaseProfileName) :                        
                        map.get(BaseProfileName) + '\n' + map.get(value);
                    await plugin.configureProfile(value, newRule);
                });
            });

        this.ruleEditor = createRuleEditorInContainer(containerEl, plugin, this.editorState, onProfileFallback);
    }
}

interface State {
    selectedProfileName: string,
    selectedProfileEl: HTMLElement,
    baseProfileEl: HTMLElement,
    profilesMap: Map<string, string>,
    editedProfile: Set<string>
}

function createRuleEditorInContainer(container: HTMLElement, plugin: TypingTransformer, state: State, onProfileFallback: () => void): EditorView {
    // source: obsidian-latex-suite setting tab, thanks a lot.
    const fragment = document.createDocumentFragment();
    fragment.createEl("span", { text: "Enter conversion, selection, and deletion rules here. NOTES:" }); //line 1
    const ol = fragment.createEl("ol");
    ol.createEl("li", { text: "Each line is one rule. Rules that come first have higher priority." }); //note 1
    ol.createEl("li", { text: "Lines starting with \"#\" are treated as comments and ignored. Inline comments are also allowed" }); //note 2
    ol.createEl("li", { text: "Certain characters ' | \\ must be escaped with backslashes \\." }); //note 3

    const convertRulesSetting = new Setting(container)
        .setName("Rules")
        .setDesc(fragment)
        .setClass("rules-text-area");

    const profilesContainer = convertRulesSetting.controlEl.createDiv("rules-profiles");
    const customCSSWrapper = convertRulesSetting.controlEl.createDiv("rules-editor-wrapper");
    const rulesFooter = convertRulesSetting.controlEl.createDiv("rules-footer");
    const validity = rulesFooter.createDiv("rules-editor-validity");

    const validityIndicator = new ExtraButtonComponent(validity);
    validityIndicator.setIcon("checkmark")
        .extraSettingsEl.addClass("rules-editor-validity-indicator");

    const validityText = validity.createDiv("rules-editor-validity-text");
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
                if (v.transactions.reduce((swtich, tr): boolean => swtich || tr.annotation(ProfileSwitch), false)) {
                    return;
                }
                const value = v.state.doc.toString();
                await feedRules(value);
            }
        })
    ];

    const feedRules = async (newRule: string) => {
        const errs = plugin.checkRules(newRule);
        if (errs.length != 0) {
            updateValidityIndicator(false, errs);
        } else {
            updateValidityIndicator(true, []);
            const { selectedProfileName: target, profilesMap: map, editedProfile: set } = state;
            const activeProfile = plugin.settings.activeProfile;
            map.set(target, newRule);
            set.add(target);
            if (target === BaseProfileName || set.has(activeProfile)) {
                log("setting: update rules");
                let newRule: string;
                if (activeProfile === BaseProfileName) {
                    newRule = map.get(BaseProfileName);
                } else {
                    newRule = map.get(BaseProfileName) + '\n' + map.get(activeProfile);
                }
                // when closing setting, hide will save this settings
                plugin.settings.convertRules = newRule;
                plugin.configureRules(newRule);
            }
        }
    };

    const setCMEditorContent = (text: string) => {
        convertRulesEditor.dispatch({
            changes: { from: 0, to: convertRulesEditor.state.doc.length, insert: text },
            annotations: ProfileSwitch.of(true)
        });
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

    const onProfileClick = (name: string, el: HTMLElement) => {
        state.selectedProfileEl?.removeClass("selected");
        el?.addClass("selected");
        state.selectedProfileEl = el;
        state.selectedProfileName = name;
        setCMEditorContent(state.profilesMap.get(name));
    };

    const onRemoveProfileClick = (name: string, el: HTMLElement) => {
        if (el === state.selectedProfileEl)
            // switch to base profile
            onProfileClick(BaseProfileName, state.baseProfileEl);
        if (plugin.settings.activeProfile == name) {
            onProfileFallback()
            plugin.configureProfile(BaseProfileName, state.profilesMap.get(BaseProfileName))
        }
        state.profilesMap.delete(name);
        state.editedProfile.add(name);
        profilesContainer.removeChild(el);
    };

    const addProfile = (profile: Profile, selected: boolean) => {
        const button = new ExtraButtonComponent(profilesContainer);
        const el = button.extraSettingsEl;
        el.accessKey = profile.title;
        button.onClick(() => onProfileClick(profile.title, el));
        el.addClass("rules-profile-button");
        el.setText(profile.title);
        if (profile.title != BaseProfileName) { // base profile can't be deleted
            const closeEl = new ExtraButtonComponent(el).setIcon("cross").extraSettingsEl;
            closeEl.onClickEvent((ev) => { ev.stopPropagation(); onRemoveProfileClick(profile.title, el); });
            closeEl.addClass("rules-profile-close");
        } else {
            state.baseProfileEl = el;
        }
        if (selected) { onProfileClick(profile.title, el); }
    };

    for (const profile of plugin.settings.profiles) {
        addProfile(profile, profile.title === BaseProfileName);
    }

    const addButton = new ExtraButtonComponent(profilesContainer).onClick(() => {
        if (state.profilesMap.size > 5) {
            new Notice("You can only have 6 profiles at most.");
            return;
        }
        new StringInputModal(app, (value: string): boolean => {
            if (state.profilesMap.has(value)) return false;
            if (value === "") return true;
            state.profilesMap.set(value, "");
            state.editedProfile.add(value);
            profilesContainer.removeChild(addButton.extraSettingsEl);
            addProfile({ title: value, content: "" }, true);
            profilesContainer.appendChild(addButton.extraSettingsEl);
            return true;
        }).open();
    });
    addButton.extraSettingsEl.addClass("rules-profile-button");
    addButton.extraSettingsEl.setText("+");

    return convertRulesEditor;
}



class StringInputModal extends Modal {
    result: string;
    onSubmit: (result: string) => boolean;

    constructor(app: App, onSubmit: (result: string) => boolean) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        new Setting(contentEl)
            .setName("Profile name")
            .addText((text) =>
                text.onChange((value) => { this.result = value; }));

        new Setting(contentEl)
            .addButton((btn) => btn
                .setButtonText("Submit")
                .setCta()
                .onClick(() => {
                    if (this.onSubmit(this.result)) this.close();
                    else err.setText("Profile already exists!");
                }));
        const err = contentEl.createEl("p");
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}