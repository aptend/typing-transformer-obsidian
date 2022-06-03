

import { Facet, Extension } from "@codemirror/state"
import { ViewPlugin, DecorationSet, ViewUpdate, EditorView, Decoration } from "@codemirror/view"

export function libertyZone(options: { size?: number } = {}): Extension {
    return [
        baseTheme,
        options.size == null ? [] : libertyZoneSize.of(options.size),
        showToLiberty,
    ]
}

const showToLiberty = ViewPlugin.fromClass(class {
    decorations: DecorationSet

    constructor(view: EditorView) {
        this.decorations = Decoration.none
    }

    update({ view: {state}, docChanged }: ViewUpdate) {
        if (docChanged) {
            let mainSel = state.selection.asSingle().main
            if (mainSel.anchor == mainSel.head) {
                let line = state.doc.lineAt(mainSel.anchor)
                let from = Math.max(line.from, mainSel.anchor - state.facet(libertyZoneSize))
                let to = mainSel.anchor
                if (from != to) {
                    this.decorations = Decoration.set([libertyZoneMark.range(from, to)])
                }
            }
        } else if (this.decorations.size) {
            console.log("clear overline", docChanged, state.selection.asSingle().main != null)
            this.decorations = Decoration.none
        }
    }

}, {
    decorations: v => v.decorations
})

const libertyZoneMark = Decoration.mark({
    attributes: { class: "cm-toLibertyZone" }
})

export const libertyZoneSize = Facet.define<number, number>({
    combine: values => values.length ? Math.min(...values) : 20
})

const baseTheme = EditorView.baseTheme({
    "&light .cm-toLibertyZone": { textDecoration: "overline #DED8F0 2px" },
    "&dark .cm-toLibertyZone": { backgroundColor: "overline #1a2727 2px" },
})
