import { baseKeymap } from 'https://esm.sh/prosemirror-commands';
import { keymap } from 'https://esm.sh/prosemirror-keymap';
import { DOMParser, DOMSerializer, Schema } from 'https://esm.sh/prosemirror-model';
import { schema as basicSchema } from 'https://esm.sh/prosemirror-schema-basic';
import { EditorState } from 'https://esm.sh/prosemirror-state';
import { EditorView } from 'https://esm.sh/prosemirror-view';

/**
 * Extend schema (underline support)
 */
const paragraph = {
  ...basicSchema.spec.nodes.get('paragraph'),

  attrs: {
    textAlign: { default: 'left' },
  },

  parseDOM: [
    {
      getAttrs: (dom) => ({
        textAlign: dom.style.textAlign || 'left',
      }),
      tag: 'p',
    },
  ],

  toDOM: (node) => ['p', { style: `text-align:${node.attrs.textAlign};` }, 0],
};

const heading = {
  ...basicSchema.spec.nodes.get('heading'),

  attrs: {
    level: { default: 1 },
    textAlign: { default: 'left' },
  },

  parseDOM: [
    { attrs: { level: 1 }, tag: 'h1' },
    { attrs: { level: 2 }, tag: 'h2' },
    { attrs: { level: 3 }, tag: 'h3' },
    { attrs: { level: 4 }, tag: 'h4' },
    { attrs: { level: 5 }, tag: 'h5' },
    { attrs: { level: 6 }, tag: 'h6' },
  ],

  toDOM: (node) => [`h${node.attrs.level}`, { style: `text-align:${node.attrs.textAlign};` }, 0],
};

export const schema = new Schema({
  marks: basicSchema.spec.marks.addToEnd('underline', {
    parseDOM: [{ tag: 'u' }],
    toDOM: () => ['u', 0],
  }),
  nodes: basicSchema.spec.nodes.update('paragraph', paragraph).update('heading', heading),
});

export function createProseMirrorEditor({ mount, content = '', onChange, onBlur }) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = content || '';

  const state = EditorState.create({
    doc: DOMParser.fromSchema(schema).parse(wrapper),
    plugins: [keymap(baseKeymap)],
  });

  const view = new EditorView(mount, {
    dispatchTransaction(tr) {
      const newState = view.state.apply(tr);
      view.updateState(newState);

      if (onChange) {
        const div = document.createElement('div');
        const fragment = DOMSerializer.fromSchema(schema).serializeFragment(newState.doc.content);
        div.appendChild(fragment);

        if (tr.docChanged) onChange(div.innerHTML);
      }
    },
    handleDOMEvents: {
      blur: (view, event) => onBlur(event.target.innerHTML),
    },
    state,
  });

  return { schema, view };
}
