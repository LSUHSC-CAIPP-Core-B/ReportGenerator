import { ReportBuilder } from "../ReportBuilder.js";
import { GroupManager } from "./GroupManager.js";
import { PendingInsertManager } from "./PendingInsertManager.js";

export class LayoutManager {

    /** @type {HTMLElement} */
    #parent;

    /** @type {HTMLElement} */
    #menu;

    /** @type {HTMLElement} */
    #content;

    /** @type {ReportBuilder} */
    #report;

    /**
     * @param {HTMLElement} parent 
     */
    constructor(report, parent) {
        this.#report = report;
        this.#parent = parent;

        const menuWrapper = document.createElement('div');
        menuWrapper.classList.add('b-menu'/*, 'js-sticky' */);
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

        this.#attachGlobalEvents();
    }

    /**
     * @param {Object} options
     * @param {string} options.title
     * @param {string} options.identifier
     * @param {number} options.depth
     * @returns { entry: HTMLElement, content: HTMLElement }
     */
    create({ title, identifier, depth }) {
        const entry = this.#createMenuEntry(title, identifier, depth);
        const content = this.#createGroupContainer(identifier);

        this.#menu.appendChild(entry);
        this.#content.appendChild(content);

        return { entry, content };
    }

    getMenuEntry(identifier) {
        return this.#menu.querySelector(`.menu-entry[aria-identifier="${identifier}"]`);
    }

    /**
     * @param {string[]} entryIds 
     */
    organize(entryIds) {
        const menuChildren = entryIds.map((identifier) => 
            this.#menu.querySelector(`.menu-entry[aria-identifier="${identifier}"]`)
        ).filter((val, index, arr) => val && arr.indexOf(val) === index);

        const contentChildren = entryIds.map((identifier) => 
            this.#content.querySelector(`.b-container[aria-identifier="${identifier}"]`)
        ).filter((val, index, arr) => val && arr.indexOf(val) === index);

        this.#menu.replaceChildren(...menuChildren);
        this.#content.replaceChildren(...contentChildren);
    }

    #attachGlobalEvents() {
        this.#handleMenuClick = this.#handleMenuClick.bind(this);
        this.#handleScroll = this.#handleScroll.bind(this);

        document.addEventListener('click', this.#handleMenuClick);
        document.addEventListener('scroll', this.#handleScroll);
        // document.removeEventListener('load', this.#handleLoad);
    }

    #handleScroll = () => {
        const navbar = document.querySelector('.b-navbar');
        if (!navbar) return;

        navbar.classList.toggle( 'scrolled', window.scrollY > 0 );
    };

    #handleLoad() {
        const stickyElements = document.querySelectorAll('.js-sticky');
        const verticalScroll = window.scrollY;

        for (const element of stickyElements) {
            if (!(element instanceof HTMLElement))
                continue;

            const style = window.getComputedStyle(element);

            if (style.position !== 'sticky')
                element.style.position = 'sticky';

            const parent = element.parentElement;
            if (!parent) continue;

            const parentStyle = window.getComputedStyle(parent);
            const parentBorder = parent.getBoundingClientRect();
            const topPadding = parseInt(parentStyle.paddingTop, 10) || 0;
            const parentStartY = (parentBorder.y + verticalScroll) + topPadding;
            element.style.top = parentStartY + 'px';
        }
    };

    collapseGroup(groupId) {
        const groupManager = this.#report.getGroupManager();
        const group = groupManager.getGroup(groupId);

        if (!group) return;

        group.collapsed = !group.collapsed;
        group.menuEntry.classList.toggle('collapsed', group.collapsed);

        const setHidden = (child, hidden) => {
            child.menuEntry.classList.toggle('hidden', hidden);
            child.content.classList.toggle('hidden', hidden);
        };

        for (const child of groupManager.getDescendants(groupId)) {
            const hidden = group.collapsed || (() => {
                let current = child;

                while (current.parentId) {
                    current = groupManager.getGroup(current.parentId);

                    if (!current) return false;
                    if (current.collapsed) return true;
                }

                return false;
            })();

            setHidden(child, hidden);
        }
    }

    #handleMenuClick = (event) => {
        let element = event.target;
        if (!(element instanceof HTMLElement)) return;
        element = element.closest('.menu-entry');

        if (!element) return;
        if (!element.classList.contains('collapsable')) return;
        
        const groupId = element.getAttribute('aria-identifier');
        if (!groupId) return;

        this.collapseGroup(groupId);
    };

    /**
     * @param {string} title
     * @param {string} identifier
     */
    #createMenuEntry(title, identifier, depth = 0) {
        const entry = document.createElement('div');

        entry.classList.add('menu-entry');
        if (depth > 0) {
            entry.classList.add('indent');
            entry.style.setProperty('--menu-indent', depth);
        }

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

    destroy() {
        document.removeEventListener('click', this.#handleMenuClick);
        document.removeEventListener('scroll', this.#handleScroll);
        document.removeEventListener('load', this.#handleLoad);
    }

}
