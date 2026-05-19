import Fuse from '../external/fuse.js-7.3.0.js';

/**
 * @param {number} value 
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * @param {number} value 
 * @param {number} min 
 * @param {number} max 
 * @returns {boolean}
 */
function between(value, min, max) {
    return value >= min && value <= max;
}

export class CommandPalette {
    /**
     * @param {Object} options
     * @param {HTMLInputElement} options.input
     * @param {HTMLElement} options.overlay
     * @param {number} [options.display_amount]
     * @param {boolean} [options.macos]
     */
    constructor({
        input, overlay,
        display_amount = 8,
        macos = false
    }) {
        // For tabs
        this.stack = [];
        this.currentActions = [];
        this.context = {};

        // For auto complete
        this.lastKeyChar = false;
        this.originalInput = '';
        this.autocomplete = false;

        // For clicking
        this.forceNoClose = false;

        this.actions = [];
        this.input = input;
        this.overlay = overlay;
        this.macos = macos ?? false;
        this.display_amount = Math.max(display_amount, 5);
        this.entries = overlay.querySelector('.cmd-entries');

        this.keydownListener = this.keydownListener.bind(this);
        this.overlayMouseMoveListener = this.overlayMouseMoveListener.bind(this);
        this.overlayClickListener = this.overlayClickListener.bind(this);
        this.documentInputChangeListener = this.documentInputChangeListener.bind(this);
        this.documentFocusChangeListener = this.documentFocusChangeListener.bind(this);
        this.documentKeydownListener = this.documentKeydownListener.bind(this);

        document.addEventListener('keydown', this.keydownListener);
        this.overlay.addEventListener('mousemove', this.overlayMouseMoveListener);
        this.overlay.addEventListener('mousedown', this.overlayClickListener);
        this.input.addEventListener('input', this.documentInputChangeListener);
        this.input.addEventListener('focus', this.documentFocusChangeListener);
        this.input.addEventListener('focusout', this.documentFocusChangeListener);
        this.input.addEventListener('keydown', this.documentKeydownListener);

        this.charReturn = document.createElement('i');
        this.charReturn.classList.add('icon-corner-down-left', 'selection');
    }

    #pushTab(actions, placeholder = '', parentAction = null) {
        this.stack.push({
            actions: this.currentActions,
            value: this.autocomplete ? this.originalInput : this.input.value,
            parentAction
        });

        // Let's reset auto complete
        this.autocomplete = false;
        this.originalInput = '';

        this.currentActions = actions;
        this.currentActions.forEach(action => {
            action.parent = parentAction;
        });

        this.input.value = placeholder;
        this.#renderCurrentActions();
    }

    #popTab() {
        const previous = this.stack.pop();
        if (!previous) return;

        this.currentActions = previous.actions;
        this.input.value = previous.value;

        this.#renderCurrentActions();
    }

    #getRecentCommands() {
        return [...this.entries.querySelectorAll('.cmd-entry:not([hidden])')]
            .map(el => this.currentActions.find(a => a.element === el));
    }

    #autocomplete() {
        // Must have been a delete key or something
        if (!this.lastKeyChar) return;

        this.originalInput = this.input.value;
        const length = this.originalInput.length;
        const query = this.originalInput.trimStart().toLowerCase();
        if (!query) return;

        const cmds = this.#getRecentCommands();
        const selected = cmds.find(({ label }) => {
            var lower = label.toLowerCase();
            var index = lower.indexOf(query);
            if (index == 0) return true;

            // needs to be start of word
            return lower.substring(index - 1, index).match(/^\s$/);
        });
        if (!selected) return;

        selected.element.appendChild(this.charReturn);
        const textIndex = selected.label.toLowerCase().indexOf(query);
        const text = selected.label.substring(textIndex + query.length);

        this.autocomplete = text.length !== 0;
        if (!this.autocomplete) return;

        this.input.value += text;
        this.input.setSelectionRange( length, length + text.length );
    }

    #renderCurrentActions() {
        this.entries.innerHTML = '';

        this.currentActions.forEach(action => {
            this.entries.appendChild(action.element);
            action.element.hidden = false;
        });

        this.#executeSearch();
        this.#validateSelector();
        this.#updateDisplay();
    }

    /**
     * @param {Object} options
     * @param {string} options.label
     * @param {string} options.icon
     * @param {string} [options.description]
     * @param {boolean} [options.closes]
     * @param {Function} [options.callback]
     * @param {Object[]} [options.tab]
     * @param {string} [options.value]
     * @param {"start" | "end"} [options.truncate]
     * 
     * @param {boolean} fromTab
     */
    addAction({
        label,
        icon = 'dot',
        description,
        closes = true,
        callback,
        tab: tabActions,
        value,
        visibility = 'shown',
        truncate = "end"
    }, fromTab = false) {
        const element = document.createElement('span');
        element.classList.add('cmd-entry');

        const iconEl = document.createElement('i');
        iconEl.classList.add('icon', 'icon-' + icon);

        const labelEl = document.createElement('p');
        labelEl.classList.add('label');
        labelEl.innerText = label;
    
        const descriptionEl = document.createElement('p');
        descriptionEl.setAttribute('truncate', truncate);
        descriptionEl.classList.add('description');
        descriptionEl.innerText = description ?? '';

        element.append(iconEl, labelEl, descriptionEl);
    
        const tab = tabActions?.map(action => this.#addTabAction(action));

        const action = {
            element, label, description,
            closes, callback, visibility,
            tab, value
        };

        if (!fromTab) {
            this.entries.appendChild(element);
            this.actions.push(action);
            if (this.stack.length === 0)
                this.currentActions.push(action);
        }

        return fromTab ? action : element;
    }

    /**
     * @param {Object} options
     */
    #addTabAction(options) {
        const action = this.addAction(options, true);
        action.element.toggleAttribute('cmd-tab-element', true);
        return action;
    }

    /**
     * @param {KeyboardEvent} event
     */
    keydownListener(event) {
        const isCommandK = (this.macos ? event.metaKey : event.ctrlKey)
            && event.key.toLowerCase() === 'k';

        if (!isCommandK) return;

        event.preventDefault();

        if (this.isOpen) this.input.blur();
        else requestAnimationFrame(() => {
            this.input.focus();
        });
    }

    /**
     * @param {HTMLElement} element
     */
    #select(element) {
        const children = this.#getVisibleCommands();
        if (children.length === 0) return;
        if (!children.includes(element)) return;

        let action = this.currentActions
            .find(action => action.element === element);

        if (action.tab) {
            this.#pushTab(action.tab, '', action);
            return false;
        }

        while (action.parent != null) {
            const result = action.callback ? action.callback(action.value) : undefined;
            const value = result ?? action.value;

            if (value != null && value != undefined)
                action.parent.value = value;

            action = action.parent;
            this.#popTab();
        }

        // Move to most recent
        const first = this.entries.firstChild;
        this.entries.insertBefore(action.element, first);

        action.callback(action.value);
        return action.closes;
    }

    /**
     * @returns {HTMLElement[]}
     */
    #getVisibleCommands() {
        return [...this.entries.querySelectorAll('.cmd-entry:not([hidden])')]
            .filter(el => this.currentActions.some(a => a.element === el));
    }

    /**
     * @param {Object} options
     * @param {boolean} options.previous
     * @param {HTMLElement} options.selected
     */
    #cycle({ previous = false, selected }) {
        const children = this.#getVisibleCommands();
        if (children.length == 0) return;
        const index = children.indexOf(selected);

        const size = children.length
        // cycle forwards or back by one
        let target = index + (previous ? -1 : 1);
        // wrap between 0 and length
        target = (target % size + size) % size;

        const child = children[target];
        child.appendChild(this.charReturn);
        this.#updateDisplay();
    }

    #validateSelector() {
        const parent = this.charReturn.parentElement;
        const children = this.#getVisibleCommands();
        if (children.indexOf(parent) == -1)
            if (children.length > 0)
                children[0].appendChild(this.charReturn);
    }

    #updateDisplay() {
        const parent = this.charReturn.parentElement;
        const children = this.#getVisibleCommands();
        const index = Math.max(children.indexOf(parent), 0);

        const half = Math.floor(this.display_amount / 2);

        let min = clamp(index - half, 0, children.length);
        let max = clamp(min + this.display_amount, 0, children.length);
        min = clamp(min - (this.display_amount - (max - min)), 0, children.length);

        children.forEach((child, i) => {
            child.style.display = between(i, min, max - 1) ? '' : 'none';
        });
    }

    /**
     * @param {MouseEvent} event
     */
    overlayMouseMoveListener(event) {
        const { clientX, clientY } = event;
        const children = this.#getVisibleCommands();

        const child = children.find(child => {
            const {left, right, top, bottom} = child.getBoundingClientRect();
            return between(clientX, left, right) && between(clientY, top, bottom);
        });

        if (child != null)
            child.appendChild(this.charReturn);
    }

    /**
     * @param {MouseEvent} event
     */
    overlayClickListener(event) {
        const selected = this.charReturn.parentElement;
        this.forceNoClose = !this.#select(selected);
    }

    /**
     * @param {InputEvent} event 
     */
    documentInputChangeListener(event) {
        const fuse = new Fuse(this.currentActions, {
            keys: ["label", "description"],
            threshold: 0.1,

            ignoreLocation: true,

            // Ignore accents
            ignoreDiacritics: true,
        });

        /** @type {string} */
        const query = this.input.value.trim();

        const matches = new Set( !query
            ? this.currentActions
            : fuse.search(query).map(result => result.item)
        );

        this.currentActions.forEach(action => {
            const { visibility } = action;
            const contains = matches.has(action);

            const canShow = visibility !== 'hidden' && !( visibility === 'searchable' && !query );
            const shown = (canShow && contains) || visibility === 'always';

            action.element.toggleAttribute( "hidden", !shown);
        });

        this.#validateSelector();
        this.#updateDisplay();
        this.#autocomplete();
    }

    /**
     * @param {KeyboardEvent} event
     */
    documentKeydownListener(event) {
        const cancelEvent = () => event.preventDefault();
        const { key } = event;

        const closes = [ 'Enter', 'Escape' ].includes(key);
        const cycles = [ 'Tab', 'ArrowUp', 'ArrowDown' ].includes(key);
        const selected = this.charReturn.parentElement;

        if (key === 'Backspace') {
            if (this.autocomplete) {
                this.autocomplete = false;
            } else if (!this.input.value) {
                cancelEvent();
                this.#popTab();
                return;
            }
        }

        if (key === 'Tab' && this.autocomplete) {
            this.autocomplete = false;
            let last = this.input.value.length;
            this.input.setSelectionRange(last, last);
            cancelEvent();
            return;
        }

        if (closes) {
            if (key === 'Enter') {
                const shouldClose = this.#select(selected);
                if (!shouldClose) return;
            }

            this.input.blur();
            this.input.value = null;
            return;
        }

        if (cycles) {
            cancelEvent();
            let previous = key === 'ArrowUp'
                || key === 'Tab' && event.shiftKey;
            this.#cycle({previous, selected});
            return;
        }

        this.lastKeyChar = key.length === 1;
    }

    /**
     * @param {FocusEvent} event 
     */
    async documentFocusChangeListener(event) {
        if (event.type === 'focus') return this.open();
        await new Promise(accept => setTimeout(accept, 10));

        if (this.forceNoClose) {
            this.forceNoClose = false;
            this.input.focus();
        } else this.close();
    }

    open() {
        this.isOpen = true;
        this.overlay.style.display = '';
        this.entries.firstChild.appendChild(this.charReturn);

        this.#executeSearch();
    }

    async close() {
        this.isOpen = false;
        this.overlay.style.display = 'none';

        while (this.stack.length > 0)
            this.#popTab();
    }

    #executeSearch() {
        this.input.dispatchEvent(new InputEvent("input"));
    }

    destroy() {
        document.removeEventListener('keydown', this.keydownListener);
        this.overlay.removeEventListener('click', this.overlayClickListener);
        this.input.removeEventListener('keydown', this.documentKeydownListener);
        this.overlay.remove();
    }
}
