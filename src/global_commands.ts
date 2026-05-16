import { Editor, MarkdownView, Command, Notice } from "obsidian";
import TypingTransformer from "./main";
import { BaseProfileName } from "./settings";

export function getAllCommands(plugin: TypingTransformer): Command[] {

    const format = {
        id: "typing-trans-toggle-format",
        name: "Toggle Auto Formatting",
        editorCallback: async (_e: Editor, _v: MarkdownView) => await plugin.toggleAutoFormat()
    };

    const zone = {
        id: "typing-trans-toggle-zone-indicator",
        name: "Toggle Auto Formatting Zone Indicator",
        editorCallback: async (_e: Editor, _v: MarkdownView) => await plugin.toggleIndicator()
    };

    const profileCommands = generateProfileCommands(plugin);

    return [format, zone, ...profileCommands];
}

export function profileCommandNameFromIndex(index: number): string {
  return `typing-trans-p${index.toString()}`
}

export function generateProfileCommands(plugin: TypingTransformer): Command[] {
    const useProfileX = async (i: number) => {
        const profs = plugin.settings.profiles;
        if (i >= profs.length) {
            new Notice(`Profile ${i} doesn't exist`);
            return;
        }
        const { title, content } = profs[i];
        // no change
        if (plugin.settings.activeProfile === title) return;
        const newRule = title === BaseProfileName ? content : profs[0].content + '\n' + content;
        plugin.configureProfile(title, newRule);
    };

    const ret = [];

    const profiles = plugin.settings.profiles;

    for (let [i, profile] of profiles.entries()) {
        // We use the index here as it will overwrite existing commands with shared indices. As long
        // as we call this on settings exit, which we DO, the commands should always work and have
        // the correct name.
        const useProfileCommand = {
            id: profileCommandNameFromIndex(i),
            name: "Apply '" + profile.title + "' Profile",
            editorCallback: async (_e: Editor, _v: MarkdownView) => {
                await useProfileX(i);
            }
        };
        ret.push(useProfileCommand);
    }

    return ret;
}
