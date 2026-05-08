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
     * @param {HTMLElement} options.input
     * @param {HTMLElement} options.overlay
     * @param {number} [options.display_amount]
     * @param {boolean} [options.macos]
     */
    constructor({
        input, overlay,
        display_amount = 8,
        macos = false
    }) {
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
        this.overlay.addEventListener('click', this.overlayClickListener);
        this.input.addEventListener('input', this.documentInputChangeListener);
        this.input.addEventListener('focus', this.documentFocusChangeListener);
        this.input.addEventListener('focusout', this.documentFocusChangeListener);
        this.input.addEventListener('keydown', this.documentKeydownListener);

        this.charReturn = document.createElement('i');
        this.charReturn.classList.add('icon-corner-down-left', 'selection');
    }

    /**
     * @param {Object} options
     * @param {HTMLElement} [options.element]
     * @param {string} options.label
     * @param {string} [options.description]
     * @param {boolean} [options.closes]
     * @param {Function} options.callback
     */
    addAction({ element, label, description, closes = true, callback }) {
        if (element === undefined)
            element = document.createElement('span');

        element.classList.add('cmd-entry');
        for (const node of element.childNodes)
            // No childs
            element.removeChild(node);

        const icon = document.createElement('i');
        icon.classList.add('icon', 'icon-dot');

        const labelEl = document.createElement('p');
        labelEl.classList.add('label');
        labelEl.innerText = label;
    
        const descriptionEl = document.createElement('p');
        descriptionEl.classList.add('description');
        descriptionEl.innerText = description ?? '';

        element.append(icon, labelEl, descriptionEl);
        
        this.entries.appendChild(element);
        this.actions.push({ element, label, description, closes, callback });

        return element;
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

        const action = this.actions
            .find(action => action.element === element);

        // Move to most recent
        const first = this.entries.firstChild;
        this.entries.insertBefore(action.element, first);

        action.callback();
        return action.closes;
    }

    /**
     * @returns {HTMLElement[]}
     */
    #getVisibleCommands() {
        return [...this.entries.querySelectorAll('.cmd-entry:not([hidden])')];
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

    }

    /**
     * @param {InputEvent} event 
     */
    documentInputChangeListener(event) {
        const fuse = new Fuse(this.actions, {
            keys: ["label", "description"],
            threshold: 0.4,
        });

        /** @type {string} */
        const query = this.input.value.trim();

        const matches = new Set( !query
            ? this.actions
            : fuse.search(query).map(result => result.item)
        );

        this.actions.forEach(action => {
            action.element.toggleAttribute(
                "hidden", !matches.has(action)
            );
        });

        this.#validateSelector();
        this.#updateDisplay();
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
    }

    /**
     * @param {FocusEvent} event 
     */
    documentFocusChangeListener(event) {
        if (event.type === 'focus') this.open();
        else this.close();
    }

    open() {
        this.isOpen = true;
        this.overlay.style.display = '';
        this.entries.firstChild.appendChild(this.charReturn);

        // execute search
        this.input.dispatchEvent(new InputEvent("input"));
    }

    close() {
        this.isOpen = false;
        this.overlay.style.display = 'none';
    }

    destroy() {
        document.removeEventListener('keydown', this.keydownListener);
        this.overlay.removeEventListener('click', this.overlayClickListener);
        this.input.removeEventListener('keydown', this.documentKeydownListener);
        this.overlay.remove();
    }
}
