

import type { Extension } from "@codemirror/state";
import { ViewPlugin, type DecorationSet, ViewUpdate, EditorView, Decoration, WidgetType } from "@codemirror/view";

// why spotter? because we need the plugin to provide special sections
export type spotter = (update: ViewUpdate) => { from: number, to: number };

export function libertyZone(zonespotter: spotter): Extension {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;
        cleanTimer: number;

        constructor(_: EditorView) {
            this.decorations = Decoration.none;
            this.cleanTimer = -1;
        }

        get isTimerActive(): boolean { return this.cleanTimer >= 0; }

        tryRemoveTimer() {
            if (this.isTimerActive) {
                window.clearTimeout(this.cleanTimer);
                this.cleanTimer = -1;
            }
        }

        update(update: ViewUpdate) {
            const range = zonespotter(update);
            // see issue https://github.com/aptend/typing-transformer-obsidian/issues/18
            if (range === undefined || update.state.doc.lineAt(range.from).from == range.from) {
                this.tryRemoveTimer();
                this.cleanTimer = window.setTimeout(() => {
                    if (this.decorations.size) {
                        this.decorations = Decoration.none;
                    }
                }, 1000 /* 1 second */);
                return;
            }
            this.decorations = Decoration.set(Decoration.widget({
                widget: new MarkWidget(15),
                side: 1,
            }).range(range.from));
            this.tryRemoveTimer();
        }
    }, {
        decorations: v => v.decorations
    });
}

export class MarkWidget extends WidgetType {
    constructor(readonly lineHeight: number) {
        super();
    }

    toDOM() {
        const mark = document.createElement("span");
        mark.style.position = "relative";
        mark.style.top = `-${this.lineHeight}px`;
        mark.innerText = "⭐️";

        const wrapper = document.createElement("div");
        wrapper.style.display = "inline-block";
        wrapper.style.position = "absolute";
        wrapper.append(mark);

        return wrapper;
    }

    ignoreEvent() {
        return false;
    }
}
