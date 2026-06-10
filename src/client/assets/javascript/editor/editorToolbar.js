import { setBlockType, toggleMark } from 'https://esm.sh/prosemirror-commands';

export class EditorToolbar {
  constructor() {
    this.#initalizeElements();

    this.view = null;

    this.toolbar.addEventListener('mousedown', (e) => {
      e.preventDefault();

      const btn = e.target.closest('button');
      if (!btn || !this.view) return;

      const { state, dispatch } = this.view;
      const { action, heading, align } = btn.dataset;
      const node = state.selection.$from.parent;

      if (heading !== undefined) {
        const args = { level: Number(heading), textAlign: 'left' };

        const blockType =
          node.attrs.level === args.level
            ? setBlockType(state.schema.nodes.paragraph)
            : setBlockType(state.schema.nodes.heading, args);

        blockType(state, dispatch);
      } else if (action !== undefined) {
        const { strong, em, underline } = state.schema.marks;

        const mark =
          action === 'bold'
            ? strong
            : action === 'italic'
              ? em
              : action === 'underline'
                ? underline
                : null;

        if (mark) toggleMark(mark)(state, dispatch);
      } else if (align !== undefined) {
        this.setParagraphStyle({ textAlign: align });
      }

      this.updateActiveState();
    });

    // const fontSelect = this.el.querySelector("[data-fontsize]");
    // fontSelect.addEventListener("change", (e) => {
    //     if (!this.view) return;
    //     this.setParagraphStyle({ fontSize: e.target.value });
    // });
  }

  #initalizeElements() {
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'pm-toolbar hidden';
    document.body.appendChild(this.toolbar);

    const mappingFn =
      (key, iconPrefix = '') =>
      (v) => {
        const button = document.createElement('button');
        button.dataset[key] = v;

        const icon = this.#createIconElement(`${iconPrefix}${v}`);
        button.appendChild(icon);

        return button;
      };

    /**
     * @param {HTMLElement} parent
     * @param {HTMLElement} child
     */
    const reducingFn = (parent, child) => {
      parent.appendChild(child);
      return parent;
    };

    const group = () => {
      const element = document.createElement('div');
      element.classList.add('toolbar-group');
      return element;
    };

    const alignElements = ['left', 'right', 'center', 'justify']
      .map(mappingFn('align', 'align-'))
      .reduce(reducingFn, group());

    const headingElements = ['1', '2', '3', '4', '5', '6']
      .map(mappingFn('heading', 'heading-'))
      .reduce(reducingFn, group());

    const actionElements = ['bold', 'italic', 'underline']
      .map(mappingFn('action'))
      .reduce(reducingFn, group());

    this.toolbar.append(headingElements, alignElements, actionElements);
  }

  /** @param {string} [icon='dot']  */
  #createIconElement(icon = 'dot') {
    const element = document.createElement('i');
    element.classList.add('icons', `icon-${icon}`);
    return element;
  }

  bind(view) {
    // Remove old listeners
    if (this.view) {
      this.view.dom.removeEventListener('mouseup', this._mouseUpHandler);
      this.view.dom.removeEventListener('keyup', this._keyUpHandler);
    }

    this.view = view;

    // Store handlers so they can be removed later
    this._mouseUpHandler = () => setTimeout(() => this.show(), 20);
    this._keyUpHandler = () => setTimeout(() => this.show(), 20);

    view.dom.addEventListener('mouseup', this._mouseUpHandler);
    view.dom.addEventListener('keyup', this._keyUpHandler);

    if (!this._documentMouseDownHandler) {
      this._documentMouseDownHandler = (e) => {
        if (!this.toolbar.contains(e.target)) {
          this.hide();
        }
      };

      document.addEventListener('mousedown', this._documentMouseDownHandler);
    }
  }

  show() {
    if (!this.view) return;
    const { from, to } = this.view.state.selection;

    if (from === to) {
      this.hide();
      return;
    }

    const rect = this.view.coordsAtPos(from);

    this.toolbar.style.top = `${rect.top}px`;
    this.toolbar.style.left = `${rect.left}px`;

    this.toolbar.classList.remove('hidden');

    this.updateActiveState();
  }

  hide() {
    this.toolbar.classList.add('hidden');
  }

  updateActiveState() {
    if (!this.view) return;
    const { state } = this.view;

    const marks = state.storedMarks || state.selection.$from.marks();
    const node = state.selection.$from.parent;

    const hasMark = (type) => marks.some((mark) => mark.type === state.schema.marks[type]);

    const matchesNode = (type, value) => node.attrs[type] === value;

    const toggleClass = (selector, condition) =>
      this.toolbar.querySelector(selector)?.classList.toggle('active', condition);

    // markers
    toggleClass('[data-action="bold"]', hasMark('strong'));
    toggleClass('[data-action="italic"]', hasMark('em'));
    toggleClass('[data-action="underline"]', hasMark('underline'));

    // headers
    toggleClass('[data-heading="1"]', matchesNode('level', 1));
    toggleClass('[data-heading="2"]', matchesNode('level', 2));
    toggleClass('[data-heading="3"]', matchesNode('level', 3));
    toggleClass('[data-heading="4"]', matchesNode('level', 4));
    toggleClass('[data-heading="5"]', matchesNode('level', 5));
    toggleClass('[data-heading="6"]', matchesNode('level', 6));

    // align
    toggleClass('[data-align="left"]', matchesNode('textAlign', 'left'));
    toggleClass('[data-align="right"]', matchesNode('textAlign', 'right'));
    toggleClass('[data-align="center"]', matchesNode('textAlign', 'center'));
    toggleClass('[data-align="justify"]', matchesNode('textAlign', 'justify'));
  }

  setParagraphStyle(attrs) {
    const { state, dispatch } = this.view;

    const node = state.selection.$from.parent;
    const { type, attrs: current } = node;

    setBlockType(type, { ...current, ...attrs })(state, dispatch);
  }
}
