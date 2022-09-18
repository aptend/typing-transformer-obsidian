import { App, Modal } from "obsidian";
import type TypingTransformer from "./main";

export class ProfileModal extends Modal {
  plugin: TypingTransformer;
  profiles: string[];
  selectedProfileName: string;
  
  constructor(app: App, plugin: TypingTransformer) {
    super(app);
    this.plugin = plugin;
    this.profiles = plugin.settings.profiles.map(p => p.title);
    this.selectedProfileName = plugin.settings.activeProfile;
  }
  
  //TODO: Create function to handle selected profile

  onOpen() {
    const {contentEl} = this;
    const wrapperEl = contentEl.createEl('div');
    this.profiles.forEach(p => {
      const profile = wrapperEl.createEl('p', {text: p});
      profile.addEventListener('click', () => this.selectedProfileName = p)
    });
  }

  onClose() {
    const {contentEl} = this;
    contentEl.empty();
  }

}