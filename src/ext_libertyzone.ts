

import { Facet, Extension, Compartment } from "@codemirror/state"
import { ViewPlugin, DecorationSet, ViewUpdate, EditorView, Decoration } from "@codemirror/view"

export let libertyZoneSize = new Compartment()

// why spotter? because we need the plugin to provide special sections
export type spotter = (update: ViewUpdate) => {from: number, to: number};

export function libertyZone(zonespotter: spotter): Extension {
    const showToLiberty = ViewPlugin.fromClass(class {
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
            this.decorations = Decoration.set([libertyZoneMark.range(range.from, range.to)])
        }
    }, {
        decorations: v => v.decorations
    })

    return [baseTheme, showToLiberty]
}


const libertyZoneMark = Decoration.mark({
    attributes: { class: "cm-toLibertyZone" }
})

export const libertyZoneSizeFacet = Facet.define<number, number>({
    combine: values => values.length ? Math.min(...values) : 20
})

const baseTheme = EditorView.baseTheme({
    "&light .cm-toLibertyZone": { textDecoration: "overline #DED8F0 2px" },
    "&dark .cm-toLibertyZone": { backgroundColor: "overline #1a2727 2px" },
})
