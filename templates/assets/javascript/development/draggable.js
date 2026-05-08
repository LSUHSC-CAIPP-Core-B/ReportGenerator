export class Draggable {
    /**
     * @type {Set<Draggable>}
     */
    static instances = new Set();

    /**
     * Initialize all draggable elements on the page
     */
    static init() {
        const elements = document.querySelectorAll(
            '[draggable="true"]'
        );

        for (const element of elements) {
            new Draggable(element);
        }
    }

    /**
     * Cleanup disconnected draggable instances
     */
    static cleanup() {
        // create a temp array
        for (const draggable of [...Draggable.instances]) {
            if (draggable.element === document) continue;
            if (!draggable.element.isConnected) draggable.destroy();
        }
    }


    /**
     * @param {HTMLElement | Document} element
     */
    constructor(element = document) {
        this.element = element;

        this.dragStartListener = this.dragStartListener.bind(this);
        this.dragEndListener = this.dragEndListener.bind(this);
        this.dragOverListener = this.dragOverListener.bind(this);

        this.element.addEventListener('dragstart', this.dragStartListener);
        this.element.addEventListener('dragend', this.dragEndListener);
        this.element.addEventListener('dragover', this.dragOverListener);
        Draggable.instances.add(this);
    }

    /**
     * @param {DragEvent} event
     */
    dragStartListener(event) {
        /** @type {Element | null} */
        const element = event.target;
        if (element == null) return;

        /** @type {DOMTokenList} */
        const classes = element.classList;
        if (!classes.contains('draggable')) return;

        classes.add('is-dragging');
        document.body.classList.add('mask-dragging');
    }

    /**
     * @param {DragEvent} event
     */
    dragEndListener(event) {
        /** @type {Element | null} */
        const element = event.target;
        if (element == null) return;

        /** @type {DOMTokenList} */
        const classes = element.classList;
        if (!classes.contains('draggable')) return;

        classes.remove('is-dragging');
        document.body.classList.remove('mask-dragging');
    }

    /**
     * @param {DragEvent} event
     */
    dragOverListener(event) {
        // Hide the default drag animation
        event.preventDefault();

        /** @type {Element | null} */
        let parent = event.target;
        if (parent == null) return;

        /** @type {Element | null} */
        const element = document.querySelector(
            '.b-container .draggable.is-dragging'
        );

        if (element == null) return;

        if (!parent.classList.contains('b-container'))
            // This must be a sibling element
            if (parent.classList.contains('draggable'))
                parent = parent.parentElement;

        // Recheck if the parent is a container
        if (parent == null || !parent.classList.contains('b-container')) return;

        const draggableElements = [
            ...parent.querySelectorAll(':scope > .draggable')
        ];

        const afterElement = draggableElements.reduce(
            (closest, child) => {
                if (child.classList.contains('is-dragging'))
                    return closest;

                const box = child.getBoundingClientRect();
                const offset = event.clientY - box.top - box.height / 2;

                if (offset < 0 && offset > closest.offset)
                    return { offset, element: child };

                return closest;
            },
            { offset: Number.NEGATIVE_INFINITY }
        )?.element;

        const selfIndex = draggableElements.indexOf(element);
        const afterElementIndex =
            draggableElements.indexOf(afterElement);

        const isInParent = selfIndex >= 0;
        const isBeforeAnElement = afterElementIndex >= 0;

        const elementPosition =
            (isBeforeAnElement
                ? afterElementIndex
                : draggableElements.length) - 1;

        const shouldUpdate =
            !isInParent || selfIndex !== elementPosition;

        if (shouldUpdate) {
            if (afterElement) parent.insertBefore(element, afterElement);
            else parent.appendChild(element);
        }
    }

    destroy() {
        this.element.removeEventListener('dragstart', this.dragStartListener);
        this.element.removeEventListener('dragend', this.dragEndListener);
        this.element.removeEventListener('dragover', this.dragOverListener);

        Draggable.instances.delete(this);
    }
}
