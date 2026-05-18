import { toggleMark } from "https://esm.sh/prosemirror-commands";

export class EditorToolbar {
    constructor() {
        this.el = document.createElement("div");
        this.el.className = "pm-toolbar hidden";

        this.el.innerHTML = `
            <button data-action="bold"><b>B</b></button>
            <button data-action="italic"><i>I</i></button>
            <button data-action="underline"><u>U</u></button>
        `;

        document.body.appendChild(this.el);

        this.view = null;

        this.el.addEventListener("mousedown", (e) => {
            e.preventDefault();

            const btn = e.target.closest("button");
            if (!btn || !this.view) return;

            const { state, dispatch } = this.view;

            switch (btn.dataset.action) {
                case "bold":
                    toggleMark(state.schema.marks.strong)(state, dispatch);
                    break;

                case "italic":
                    toggleMark(state.schema.marks.em)(state, dispatch);
                    break;

                case "underline":
                    toggleMark(state.schema.marks.underline)(state, dispatch);
                    break;
            }

            this.updateActiveState();
        });
    }

    bind(view) {
        this.view = view;

        view.dom.addEventListener("mouseup", () => this.show());
        view.dom.addEventListener("keyup", () => this.show());

        document.addEventListener("mousedown", (e) => {
            if (!this.el.contains(e.target)) {
                this.hide();
            }
        });
    }

    show() {
        if (!this.view) return;

        const { from, to } = this.view.state.selection;

        if (from === to) {
            this.hide();
            return;
        }

        const rect = this.view.coordsAtPos(from);

        this.el.style.top = `${rect.top - 40}px`;
        this.el.style.left = `${rect.left}px`;

        this.el.classList.remove("hidden");

        this.updateActiveState();
    }

    hide() {
        this.el.classList.add("hidden");
    }

    updateActiveState() {
        if (!this.view) return;

        const { state } = this.view;
        const marks = state.storedMarks || state.selection.$from.marks();

        const has = (type) =>
            marks.some(m => m.type === state.schema.marks[type]);

        this.el.querySelector('[data-action="bold"]')
            .classList.toggle("active", has("strong"));

        this.el.querySelector('[data-action="italic"]')
            .classList.toggle("active", has("em"));

        this.el.querySelector('[data-action="underline"]')
            .classList.toggle("active", has("underline"));
    }
}