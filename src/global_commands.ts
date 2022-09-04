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

    const ret = [format, zone];


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

    for (let i = 0; i < 6; i++) {
        const useProfileCommand = {
            id: "typing-trans-p" + i.toString(),
            name: "apply profile " + i.toString() + (i === 0 ? " (global)" : ""),
            editorCallback: async (_e: Editor, _v: MarkdownView) => {
                await useProfileX(i);
            }
        };
        ret.push(useProfileCommand);
    }
    return ret;
}
