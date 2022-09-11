import { App, PluginSettingTab, Setting, ButtonComponent, ExtraButtonComponent, Notice, Modal, TextComponent, Component } from "obsidian";
import type TypingTransformer from "./main";

import RuleEditor from "./components/RuleEditor.svelte"



export class SettingTab2 extends PluginSettingTab {
    plugin: TypingTransformer;
   
    constructor(app: App, plugin: TypingTransformer) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async hide() {}

    display(): void {
        const { containerEl, plugin } = this;
        containerEl.empty();
        const editor = new RuleEditor({
            target: containerEl,
            props: {plugin: plugin},
        });
    }
}