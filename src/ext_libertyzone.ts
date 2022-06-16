

import { Extension } from "@codemirror/state"
import { ViewPlugin, DecorationSet, ViewUpdate, EditorView, Decoration, WidgetType } from "@codemirror/view"


// why spotter? because we need the plugin to provide special sections
export type spotter = (update: ViewUpdate) => {from: number, to: number};

export function libertyZone(zonespotter: spotter): Extension {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet

        constructor(_: EditorView) {
            this.decorations = Decoration.none
        }

        update(update: ViewUpdate) {
            const range = zonespotter(update)
            if (range === undefined) {
                if (this.decorations.size) {
                    this.decorations = Decoration.none
                }
                return
            }
            this.decorations = Decoration.set(Decoration.widget({
                widget: new MarkWidget(15),
                side: 1,
            }).range(range.from))
        }
    }, {
        decorations: v => v.decorations
    })
}

export class MarkWidget extends WidgetType {
    constructor(readonly lineHeight: number) {
        super();
    }

    toDOM() {
        const mark = document.createElement("span");
        mark.style.position = "relative"
        mark.style.top = `-${this.lineHeight}px`
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
