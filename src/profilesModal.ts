import { App, Modal } from "obsidian";
import type TypingTransformer from "./main";

export class ProfileModal extends Modal {
  plugin: TypingTransformer;
  profiles: string[];
  selectedProfile: string;
  
  constructor(app: App, plugin: TypingTransformer) {
    super(app);
    this.plugin = plugin;
    this.profiles = plugin.settings.profiles.map(p => p.title);
    this.selectedProfile = plugin.settings.activeProfile;
  }
  
  configureProfile = async (title: string) => {
    this.plugin.settings.activeProfile = title;
    this.plugin.updateProfileStatus();
    await this.plugin.saveSettings();
  };

  onOpen() {
    const {contentEl} = this;
    const wrapperEl = contentEl.createEl('div');
    this.profiles.forEach(p => {
      const profile = wrapperEl.createEl('p', {text: p});
      profile.addEventListener('click', () => {
        this.selectedProfile = p;
        this.close();
        this.plugin.saveSettings();
      })
    });
  }

  onClose() {
    console.log(this.selectedProfile)
    console.log(this.plugin.settings.activeProfile)
    this.configureProfile(this.selectedProfile)
    const {contentEl} = this;
    contentEl.empty();
  }
}