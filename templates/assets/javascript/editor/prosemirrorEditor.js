import { EditorState } from "https://esm.sh/prosemirror-state";
import { EditorView } from "https://esm.sh/prosemirror-view";
import { DOMParser, DOMSerializer, Schema } from "https://esm.sh/prosemirror-model";
import { schema as basicSchema } from "https://esm.sh/prosemirror-schema-basic";
import { keymap } from "https://esm.sh/prosemirror-keymap";
import { baseKeymap } from "https://esm.sh/prosemirror-commands";

/**
 * Extend schema (underline support)
 */
const schema = new Schema({
    nodes: basicSchema.spec.nodes,
    marks: basicSchema.spec.marks.addToEnd("underline", {
        parseDOM: [{ tag: "u" }],
        toDOM() {
            return ["u", 0];
        }
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