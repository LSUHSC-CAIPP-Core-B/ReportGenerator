import { EditorState } from "https://esm.sh/prosemirror-state";
import { EditorView } from "https://esm.sh/prosemirror-view";
import { DOMParser, DOMSerializer, Schema } from "https://esm.sh/prosemirror-model";
import { schema as basicSchema } from "https://esm.sh/prosemirror-schema-basic";
import { keymap } from "https://esm.sh/prosemirror-keymap";
import { baseKeymap } from "https://esm.sh/prosemirror-commands";

/**
 * Extend schema (underline support)
 */
const paragraph = {
    ...basicSchema.spec.nodes.get("paragraph"),

    attrs: {
        textAlign: { default: "left" }
    },

    parseDOM: [{
        tag: "p",
        getAttrs: (dom) => ({
            textAlign: dom.style.textAlign || "left"
        })
    }],

    toDOM: (node) => [ "p", { style: `text-align:${node.attrs.textAlign};` }, 0 ]
};

const heading = {
    ...basicSchema.spec.nodes.get("heading"),

    attrs: {
        level: { default: 1 },
        textAlign: { default: "left" }
    },

    parseDOM: [
        { tag: "h1", attrs: { level: 1 } },
        { tag: "h2", attrs: { level: 2 } },
        { tag: "h3", attrs: { level: 3 } },
        { tag: "h4", attrs: { level: 4 } },
        { tag: "h5", attrs: { level: 5 } },
        { tag: "h6", attrs: { level: 6 } }
    ],

    toDOM: (node) => [ `h${node.attrs.level}`, { style: `text-align:${node.attrs.textAlign};` }, 0 ]
};


export const schema = new Schema({
    nodes: basicSchema.spec.nodes
        .update("paragraph", paragraph)
        .update("heading", heading),

    marks: basicSchema.spec.marks.addToEnd("underline", {
        parseDOM: [{ tag: "u" }],
        toDOM: () => ["u", 0]
    })
});

export function createProseMirrorEditor({
    mount,
    content = "",
    onChange
}) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = content || "";

    const state = EditorState.create({
        doc: DOMParser.fromSchema(schema).parse(wrapper),
        plugins: [
            keymap(baseKeymap)
        ]
    });

    const view = new EditorView(mount, {
        state,

        dispatchTransaction(tr) {
            const newState = view.state.apply(tr);
            view.updateState(newState);

            if (onChange) {
                const div = document.createElement("div");

                const fragment =
                    DOMSerializer.fromSchema(schema)
                        .serializeFragment(newState.doc.content);

                div.appendChild(fragment);

                onChange(div.innerHTML);
            }
        }
    });

    return { view, schema };
}