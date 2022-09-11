import { App, PluginSettingTab, Setting, ButtonComponent, ExtraButtonComponent, Notice, Modal, TextComponent, Component } from "obsidian";
import type TypingTransformer from "./main";

import Number from "./components/Number.svelte"



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
        const number = new Number({
            target: containerEl,
            props: {variable: 42}
        })       
    }
}