
class CommandPalette {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.input
     * @param {HTMLElement} options.overlay
     */
    constructor({ input, overlay }) {
        this.input = input;
        this.overlay = overlay;
        this.actions = [];
        this.isMac = isMac || false;

        this.keydownListener = this.keydownListener.bind(this);
        this.overlayMouseMoveListener = this.overlayMouseMoveListener.bind(this);
        this.overlayClickListener = this.overlayClickListener.bind(this);
        this.documentFocusChangeListener = this.documentFocusChangeListener.bind(this);
        this.documentKeydownListener = this.documentKeydownListener.bind(this);

        document.addEventListener('keydown', this.keydownListener);
        this.overlay.addEventListener('mousemove', this.overlayMouseMoveListener);
        this.overlay.addEventListener('click', this.overlayClickListener);
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
     * @param {Function} options.callback 
     */
    addAction({ element, label, description, callback }) {
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
        
        this.overlay.appendChild(element);
        this.actions.push({ element, label, description, callback });

        return element;
    }

    /**
     * @param {KeyboardEvent} event
     */
    keydownListener(event) {
        const isCommandK = (isMac ? event.metaKey : event.ctrlKey)
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
        const action = this.actions
            .find(action => action.element === element);

        // Move to most recent
        const first = this.overlay.firstChild;
        this.overlay.insertBefore(action.element, first);

        action.callback();
    }

    /**
     * @param {MouseEvent} event
     */
    overlayMouseMoveListener(event) {
        const { clientX, clientY } = event;

        const children = [...this.overlay.children];

        const child = children.find(child => {
            const {left, right, top, bottom} = child.getBoundingClientRect();

            return clientX >= left && clientX <= right
                && clientY >= top && clientY <= bottom;
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
     * @param {KeyboardEvent} event
     */
    documentKeydownListener(event) {
        switch (event.key) {
            case 'Enter':
                const entry = this.overlay.querySelector('.cmd-entry:has(i.selection)');
                this.#select(entry);
            case 'Escape':
                this.input.blur();
                break;
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
        this.overlay.firstChild.appendChild(this.charReturn);
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