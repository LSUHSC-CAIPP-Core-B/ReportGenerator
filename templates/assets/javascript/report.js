import { FrameHandler } from './iframe.js';
import { TableHandler } from './table.js';
import { createProseMirrorEditor } from "./editor/prosemirrorEditor.js";
import { EditorToolbar } from "./editor/editorToolbar.js";

const toolbar = new EditorToolbar();

class ReportElement {
    /**
     * @param {Object} options
     * @param {string} options.id
     * @param {string} options.type
     * @param {HTMLElement} options.node
     * @param {Object} options.data
     */
    constructor({ id, type, node, data = {} }) {
        this.id = id;
        this.type = type;
        this.node = node;
        this.data = data;
    }
}

class ReportGroup {
    /**
     * @param {Object} options
     * @param {string} options.id
     * @param {string} options.title
     * @param {HTMLElement} options.menuEntry
     * @param {HTMLElement} options.content
     */
    constructor({ id, title, menuEntry, content }) {
        this.id = id;
        this.title = title;

        this.menuEntry = menuEntry;
        this.content = content;

        /** @type {ReportElement[]} */
        this.elements = [];
    }
}

export class ReportBuilder {

    /** @type {HTMLElement | null} */
    #pendingElement = null;

    /** @type {number | null} */
    #pendingInsertIndex = 0;
    /** @type {string | null} */
    #pendingInsertGroupId = null;

    /** @type {HTMLElement | null} */
    #insertMarker = null;

    /** @type {number} */
    #insertionDelay = 0;

    /** @type {boolean} */
    #initialized = false;

    /** @type {HTMLElement} */
    #parent;

    /** @type {HTMLElement} */
    #menu;

    /** @type {HTMLElement} */
    #content;

    /** @type {Map<string, ReportGroup>} */
    #groups = new Map();

    /** @type {Map<string, ReportElement>} */
    #elements = new Map();

    /** @type {string[]} */
    #groupOrder = [];

    /**
     * @param {Object} options
     * @param {string} options.project
     * @param {any[]} options.groups
     * @param {HTMLElement} parent
     */
    static init({ project, groups = [] }, parent = document.body) {
        const report = new ReportBuilder();

        report.projectId = project;
        report.#parent = parent;

        report.#initializeElements();

        for (const group of groups)
            report.withGroup(group);

        return report;
    }

    #initializeElements() {
        if (this.#initialized) return;

        const menuWrapper = document.createElement('div');
        menuWrapper.classList.add('b-menu', 'js-sticky');
        this.#parent.appendChild(menuWrapper);

        const title = document.createElement('div');
        title.classList.add('menu-title');
        title.innerText = 'Table of Contents';

        menuWrapper.appendChild(title);

        this.#menu = document.createElement('div');
        this.#menu.classList.add('menu-container');
        menuWrapper.appendChild(this.#menu);

        this.#content = document.createElement('div');
        this.#content.classList.add('b-content');
        this.#parent.appendChild(this.#content);

        this.#insertMarker = document.createElement('div');
        this.#insertMarker.classList.add('insert-marker');

        this.#initialized = true;
    }

    /**
     * @param {Object} options
     * @param {string} options.title
     * @param {any[]} options.elements
     * @param {string} [options.identifier]
     */
    withGroup({ title, elements = [], identifier = this.#createIdentifier() }) {
        const menuEntry = this.#createMenuEntry(title, identifier);
        const content = this.#createGroupContainer(identifier);
        const group = new ReportGroup({ id: identifier, title, menuEntry, content });

        this.#groups.set(identifier, group);
        this.#groupOrder.push(identifier);

        this.#menu.appendChild(menuEntry);
        this.#content.appendChild(content);

        for (const element of elements)
            this.addElementToGroup(identifier, element);

        this.#attachGroupEvents(group);
        return group;
    }

    /**
     * @param {string} groupId
     * @param {Object} options
     */
    addElementToGroup(groupId, options) {
        return this.insertElementIntoGroup(groupId, options, null, false);
    }

    /**
     * @param {string} groupId
     * @param {Object} options
     * @param {number} [index]
     */
    insertElementIntoGroup(groupId, options, index = null, edit = false) {
        const group = this.#groups.get(groupId);
        if (!group) return null;

        const element = this.#createElementFromType(options, edit);
        if (!element) return null;

        if (index == null) index = group.elements.length;

        group.elements.splice(index, 0, element);
        this.#elements.set(element.id, element);
        this.#attachElementEvents(element, groupId);

        const beforeNode = group.content.children[index];
        if (beforeNode) group.content.insertBefore(element.node, beforeNode);
        else group.content.appendChild(element.node);

        return element;
    }

    /**
     * @param {string} groupId
     * @param {string} targetId
     * @param {'before'|'after'} position
     */
    moveGroup(groupId, targetId, position = 'after') {
        const group = this.#groups.get(groupId);
        const target = this.#groups.get(targetId);

        if (!group || !target) return;

        if (position === 'before') {
            target.menuEntry.before(group.menuEntry);
            target.content.before(group.content);
        } else {
            target.menuEntry.after(group.menuEntry);
            target.content.after(group.content);
        }

        this.#recalculateOrder();
    }

    /**
     * @param {string} elementId
     * @param {string} sourceGroupId
     * @param {string} targetGroupId
     */
    moveElementToGroup(elementId, sourceGroupId, targetGroupId) {
        if (sourceGroupId === targetGroupId) return;

        const sourceGroup = this.#groups.get(sourceGroupId);
        const targetGroup = this.#groups.get(targetGroupId);

        const element = this.#elements.get(elementId);

        if (!sourceGroup || !targetGroup || !element) return;

        // Remove from source array
        sourceGroup.elements = sourceGroup.elements.filter(
            el => el.id !== elementId
        );

        // Add to target array
        targetGroup.elements.push(element);

        // Move DOM node
        targetGroup.content.appendChild(element.node);

        // Rebind drag source group
        this.#attachElementEvents(element, targetGroupId);
    }

    #recalculateOrder() {
        this.#groupOrder = [...this.#menu.children]
            .map(node => node.getAttribute('aria-identifier'))
            .filter(Boolean);
    }

    /**
     * @param {string} title
     * @param {string} identifier
     */
    #createMenuEntry(title, identifier) {
        const entry = document.createElement('div');
        entry.classList.add('menu-entry');
        entry.setAttribute('aria-identifier', identifier);

        entry.draggable = true;

        const text = document.createElement('p');
        text.classList.add('desc');
        text.innerText = title;

        entry.appendChild(text);
        return entry;
    }

    /**
     * @param {string} identifier
     */
    #createGroupContainer(identifier) {
        const group = document.createElement('div');
        group.classList.add('b-container');
        group.setAttribute('aria-identifier', identifier);

        return group;
    }

    #createElementShell(identifier) {
        const element = document.createElement('div');
        element.classList.add('b-element');
        element.setAttribute('aria-identifier', identifier);
        element.draggable = true;

        return element;
    }

    #createElementFromType(options, edit = false) {
        const { type } = options;

        switch (type) {
            case 'description':
                return this.createDescription(options, edit);

            case 'html':
            case 'pdf':
                return this.createFrameElement(options, edit);

            case 'png':
            case 'svg':
            case 'jpeg':
            case 'jpg':
            case 'tiff':
            case 'tif':
                return this.createImageElement(options, edit);

            case 'csv':
                return this.createTableElement(options, edit);
        }

        return this.createDescription({
            description: `Unsupported element type: ${type}`
        });
    }

    /**
     * @param {Object} options
     * @param {boolean} edit 
     */
    createDescription({ description = 'Sample description', identifier = this.#createIdentifier() }, edit = false) {
        const shell = this.#createElementShell(identifier);
        const mount = document.createElement("div");
        mount.classList.add("pm-mount");
        shell.appendChild(mount);

        const element = new ReportElement({
            id: identifier,
            type: "description",
            node: shell,
            data: { description }
        });

        const { view } = createProseMirrorEditor({
            mount,
            content: description,
            onChange: (html) => {
                element.data.description = html;
            }
        });

        toolbar.bind(view);

        return element;
    }

    /**
     * @param {Object} options
     * @param {boolean} edit 
     */
    createImageElement({ file, description, identifier = this.#createIdentifier() }, edit = false) {
        if (!file) return null;

        const shell = this.#createElementShell(identifier);
        const image = document.createElement('img');
        image.classList.add('b-image');
        image.src = `database/${this.projectId}/${file}/$`;
        shell.appendChild(image);

        const element = new ReportElement({
            id: identifier,
            type: 'image',
            node: shell,
            data: { file, description }
        });

        if (description) {
            const desc = document.createElement('p');
            desc.classList.add('b-description');
            desc.innerText = description;
            shell.appendChild(desc);

            this.#attachDescriptionEditing(element, desc);
        }

        return element;
    }

    /**
     * @param {Object} options
     * @param {boolean} edit 
     */
    createFrameElement({ file, identifier = this.#createIdentifier() }, edit = false) {
        if (!file) return null;

        const shell = this.#createElementShell(identifier);
        const frame = document.createElement('iframe');
        frame.classList.add('b-frame');
        frame.src = `database/${this.projectId}/${file}/$`;
        shell.appendChild(frame);

        FrameHandler.handle(frame);

        return new ReportElement({
            id: identifier,
            type: 'frame',
            node: shell,
            data: { file }
        });
    }

    /**
     * @param {Object} options
     * @param {boolean} edit 
     */
    createTableElement({ file, type, extras, identifier = this.#createIdentifier() }, edit = false) {
        if (!file) return null;

        const shell = this.#createElementShell(identifier);
        const table = document.createElement('table');
        table.classList.add('b-table');

        table.setAttribute('aria-table', `database/${this.projectId}/${file}/$`);
        table.setAttribute('aria-filetype', type);
        table.toggleAttribute('aria-row-index', extras?.index === true);

        if (Array.isArray(extras?.column_order))
            table.setAttribute('aria-column-order', extras.column_order.join(','));
        
        TableHandler.fromElement(table);
        shell.appendChild(table);

        return new ReportElement({
            id: identifier,
            type: 'table',
            node: shell,
            data: { file, type, extras }
        });
    }

    /**
     * @param {ReportElement} element 
     * @param {HTMLParagraphElement} textNode 
     */
    #attachDescriptionEditing(element, textNode) {
        const toolbar = this.#createFormatToolbar();
        toolbar.style.display = 'none';

        let editing = false;
        let originalValue = textNode.innerText;
        const startEditing = () => {
            if (editing) return;

            editing = true;
            originalValue = textNode.innerText;
            textNode.contentEditable = true;
            textNode.spellcheck = true;
            textNode.classList.add('editing');

            textNode.focus();

            const range = document.createRange();
            range.selectNodeContents(textNode);

            const selection = window.getSelection();
            selection.removeAllRanges(); // Clear any existing selections
            selection.addRange(range);

            toolbar.style.display = 'flex';
            const rect = textNode.getBoundingClientRect();

            toolbar.style.top = `${rect.top - 40}px`;
            toolbar.style.left = `${rect.left}px`;
        };

        const stopEditing = (save = true) => {
            if (!editing) return;

            editing = false;
            textNode.contentEditable = false;
            textNode.classList.remove('editing');
            textNode.blur();

            if (save) element.data.description = textNode.innerHTML;
            else textNode.innerHTML = originalValue;

            toolbar.style.display = 'none';
        };

        textNode.addEventListener('dblclick', event => {
            event.stopPropagation();
            startEditing();
        });

        textNode.addEventListener('keydown', event => {
            if (!editing) return;

            switch (event.key) {
                case 'Enter':
                    if (event.shiftKey) break;
                case 'Tab':
                    event.preventDefault();
                    stopEditing(true);
                    break;

                case 'Escape':
                    event.preventDefault();
                    stopEditing(false);
                    break;
            }
        });

        toolbar.addEventListener('mousedown', (event) => {
            event.preventDefault(); // prevents losing focus
            const button = event.target.closest('button');
            if (!button) return;

            const action = button.dataset.action;

            switch (action) {
                case 'bold': applyFormat('b'); break;
                case 'italic': applyFormat('i'); break;
                case 'underline': applyFormat('u'); break;
            }
        });

        textNode.addEventListener('blur', () => stopEditing(true));
    }

    #createFormatToolbar() {
        const bar = document.createElement('div');
        bar.classList.add('format-toolbar');

        bar.innerHTML = `
            <button data-action="bold"><b>B</b></button>
            <button data-action="italic"><i>I</i></button>
            <button data-action="underline"><u>U</u></button>
        `;

        document.body.appendChild(bar);

        return bar;
    }

    beginPendingElement(options) {
        this.#pendingElement = options;
        const firstGroupId = this.#groupOrder[0];

        this.#pendingInsertGroupId = firstGroupId;
        const group = this.#groups.get(firstGroupId);

        // let's delay by 15ms
        this.#insertionDelay = Date.now() + 15;
        this.#pendingInsertIndex = 0;

        this.#updateKeyboardInsertMarker();
        document.addEventListener('keydown', this.#handlePendingKeybinds);
        document.body.classList.add('local');
    }

    cancelPendingElement() {
        this.#pendingElement = null;
        this.#pendingInsertIndex = null;
        this.#pendingInsertGroupId = null;

        this.#insertMarker.parentNode?.removeChild(this.#insertMarker);

        this.#clearGroupSelectionUI();

        document.removeEventListener('keydown', this.#handlePendingKeybinds);
        document.body.classList.remove('local');
    }

    #handlePendingKeybinds = (event) => {
        if (!this.#pendingElement) return;
        if (this.#insertionDelay > Date.now()) return;

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.#moveInsertPosition(1);
                break;

            case 'ArrowUp':
                event.preventDefault();
                this.#moveInsertPosition(-1);
                break;

            case 'Enter':
                event.preventDefault();

                this.insertElementIntoGroup(
                    this.#pendingInsertGroupId,
                    this.#pendingElement,
                    this.#pendingInsertIndex,
                    true
                );

                this.cancelPendingElement();
                break;

            case 'Escape':
                event.preventDefault();
                this.cancelPendingElement();
                break;
        }
    };

    #moveInsertPosition(direction) {
        const groupIds = this.#groupOrder;
        let groupIndex = groupIds.indexOf(this.#pendingInsertGroupId);
        const group = this.#groups.get(this.#pendingInsertGroupId);

        if (!group) return;

        let nextIndex = this.#pendingInsertIndex + direction;

        if (direction < 0) {
            // Up Arrow
            if (nextIndex < 0) {
                if (groupIndex <= 0) return;
                groupIndex--;

                const prevGroup = this.#groups.get(groupIds[groupIndex]);
                this.#pendingInsertGroupId = prevGroup.id;
                this.#pendingInsertIndex = prevGroup.elements.length;
            } else this.#pendingInsertIndex = nextIndex;
        } else {
            // Down Arrow
            if (nextIndex > group.elements.length) {
                if (groupIndex >= groupIds.length - 1) return;
                groupIndex++;

                const nextGroup = this.#groups.get(groupIds[groupIndex]);
                this.#pendingInsertGroupId = nextGroup.id;
                this.#pendingInsertIndex = 0;
            } else this.#pendingInsertIndex = nextIndex;
        }

        this.#updateKeyboardInsertMarker();
    }

    #updateKeyboardInsertMarker() {
        const group = this.#groups.get(this.#pendingInsertGroupId);
        if (group) this.#showInsertMarker(group, this.#pendingInsertIndex, true);
    }

    #clearGroupSelectionUI() {
        for (const group of this.#groups.values())
            group.content.classList.remove('pending-target');
    }

    #attachGroupEvents(group) {
        const menuEntry = group.menuEntry;
        const content = group.content;

        menuEntry.addEventListener('dragstart', event => {
            event.dataTransfer.setData('text/group-id', group.id);
        });

        menuEntry.addEventListener('dragover', event => {
            event.preventDefault();
            content.classList.add('drag-hover');
        });

        menuEntry.addEventListener('dragleave', () => {
            content.classList.remove('drag-hover');
        });

        menuEntry.addEventListener('drop', event => {
            event.preventDefault();

            content.classList.remove('drag-hover');
            const elementId = event.dataTransfer.getData('text/element-id');
            const sourceGroupId = event.dataTransfer.getData('text/source-group-id');

            if (elementId && sourceGroupId)
                this.moveElementToGroup(elementId, sourceGroupId, group.id);

            const targetId = group.id;
            const sourceId = event.dataTransfer.getData('text/group-id');
            if ( !sourceId || sourceId === targetId ) return;

            const rect = menuEntry.getBoundingClientRect();
            const before = event.clientY < rect.top + rect.height / 2;

            this.moveGroup( sourceId, targetId, before ? 'before' : 'after' );
        });

        group.content.addEventListener('mousemove', event => {
            if (!this.#pendingElement) return;

            const children = [ ...group.content.querySelectorAll('.b-element') ];
            let insertIndex = children.length;

            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                const rect = child.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;

                if (event.clientY < midpoint) {
                    insertIndex = i;
                    break;
                }
            }

            this.#pendingInsertGroupId = group.id;
            this.#pendingInsertIndex = insertIndex;
            this.#showInsertMarker(group, insertIndex);
        });

        group.content.addEventListener('click', () => {
            if (!this.#pendingElement) return;

            this.insertElementIntoGroup(
                this.#pendingInsertGroupId,
                this.#pendingElement,
                this.#pendingInsertIndex
            );

            this.cancelPendingElement();
        });
    }

    #showInsertMarker(group, index, scroll = false) {
        this.#pendingInsertGroupId = group.id;
        this.#pendingInsertIndex = index;

        const children = [ ...group.content.querySelectorAll('.b-element') ];
        const beforeNode = children[index];

        if (beforeNode) group.content.insertBefore( this.#insertMarker, beforeNode );
        else group.content.appendChild( this.#insertMarker );

        const view_padding = 120;
        const rect = this.#insertMarker.getBoundingClientRect();
        const visible = rect.top >= view_padding && rect.bottom <= (window.innerHeight - view_padding);
        
        if (!visible && scroll) this.#insertMarker.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    #attachElementEvents(element, groupId) {
        element.node.addEventListener('dragstart', event => {
            event.dataTransfer.setData('text/element-id', element.id);
            event.dataTransfer.setData('text/source-group-id', groupId);
        });
    }

    toJSON() {
        return {
            project: this.projectId,
            groups: this.#groupOrder.map(id => {
                const group = this.#groups.get(id);

                return {
                    identifier: group.id,
                    title: group.title,
                    elements: group.elements.map(
                        element => ({
                            identifier: element.id,
                            type: element.type,
                            ...element.data
                        })
                    )
                };
            })
        };
    }

    #createIdentifier(length = 12) {
        const digits = '0123456789';
        const letters = 'abcdefghijklmnopqrstuvwxyz';

        return new Array(length).fill(0)
            .map(() => Math.random() > 0.6 ? digits : letters)
            .map(v => Math.random() > 0.5 ? v.toUpperCase() : v.toLowerCase())
            .map(v => v[Math.floor(Math.random() * v.length)])
            .join('');
    }
}