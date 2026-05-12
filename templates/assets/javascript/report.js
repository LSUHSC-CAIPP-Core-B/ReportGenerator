import { FrameHandler } from './iframe.js';
import { TableHandler } from './table.js';

export class ReportBuilder {

    /** @type {boolean} */
    #initalized = false;

    /** @type {HTMLElement} */
    #parent;

    /** @type {HTMLElement} */
    #menu;
    /** @type {HTMLElement} */
    #content;

    /**
     * @param {object} options 
     * @param {string} options.project 
     * @param {any[]} options.groups
     *
     * @param {HTMLElement} parent
     */
    static init({ project, groups }, parent = document.body) {
        const report = new ReportBuilder();
        report.projectId = project;
        report.#parent = parent;

        report.#initalizeElements();

        if (groups !== null)
            for (const group of groups)
                report.withGroup(group);

        return report;
    }

    #initalizeElements() {
        if (this.#initalized) return;

        const menu = document.createElement('div');
        menu.classList.add('b-menu', 'js-sticky');
        this.#parent.appendChild(menu);

        const toc = this.#createMenuEntry('Table of Contents');
        toc.classList.replace('menu-entry', 'menu-title');
        menu.appendChild(toc);

        this.#menu = document.createElement('div');
        this.#menu.classList.add('menu-container');
        menu.appendChild(this.#menu);

        this.#content = document.createElement('div');
        this.#content.classList.add('b-content');
        this.#parent.appendChild(this.#content);

        this.#initalized = true;
    }

    /**
     * @param {Object} options 
     * @param {string} options.title
     * @param {any[]} options.elements
     */
    withGroup({ title, elements = [] }) {
        const entry = this.#createMenuEntry(title);
        this.#menu.appendChild(entry);
        
        const group = this.#createGroup(elements);
        this.#content.appendChild(group);
        // this.#parent;
    }

    #createElement() {
        const div = document.createElement('div');
        div.classList.add('b-element');
        return div;
    }

    /**
     * @param {string} title 
     */
    #createMenuEntry(title) {
        const div = document.createElement('div');
        div.classList.add('menu-entry');
    
        const p = document.createElement('p');
        p.classList.add('desc');
        p.innerText = title;
        div.appendChild(p);

        return div;
    }

    #createGroup(elements) {
        const group = document.createElement('div');
        group.classList.add('b-container');
        group.append( ...elements.map(element => 
            this.#createElementFromType(element)
        ) );
        
        return group;


    //     <div class="b-container">
    //     {%- for element in group.elements %}
    //     {%- if element.file == null %}
    //         {%- case element.type %}
    //         {%- when "description" %}
    //         {% include "components/types/description.html" %}
    //         {%- endcase %}
    //     {%- else %}
    //         {%- capture identifier %}{% randomid %}{% endcapture %}
    //         {%- case element.type %}
    //         {%- when "html", "pdf" %}
    //         {% include "components/types/frame.html" %}
    //         {%- when "png", "svg", "jpeg", "jpg", "tiff", "tif" %}
    //         {% include "components/types/image.html" %}
    //         {%- when "csv" %}
    //         {% include "components/types/table.html" %}
    //         {%- else %}
    //         <p>{{ element | json }}</p>
    //         {%- endcase %}
    //     {%- endif %}
    //     {%- endfor %}
    // </div>
    }

    #createElementFromType(options) {
        const { type, description } = options;
        switch (type) {
            case 'description':
                const parent = this.#createElement();
                return this.createDescription({ description, parent });
            case 'html':
            case 'pdf':
                return this.createFrameElement(options);
            case 'png':
            case 'svg':
            case 'jpeg':
            case 'jpg':
            case 'tiff':
            case 'tif':
                return this.createImageElement(options);
            case 'csv':
                return this.createTableElement(options);
        }

        return this.createDescription({
            description: 'Unsupported element type: ' + type
        });
    }

    /**
     * @param {Object} options
     * @param {string} [options.description]
     * @param {HTMLElement} [options.parent]
     */
    createDescription({ description, parent }) {
        const desc = document.createElement('p');
        desc.classList.add('b-description');
        desc.innerText = description ?? 'Sample description...';

        const element = parent ?? this.#createElement();
        element.appendChild(desc);

        return (!parent) ? desc : element;
    }

    /**
     * @param {Object} options
     * @param {string} options.file
     * @param {string} [options.description] 
     */
    createImageElement({ file, description }) {
        if (!file) return null;
        const parent = this.#createElement();

        const image = document.createElement('img');
        image.classList.add('b-image');
        image.src = `database/${this.projectId}/${file}/$`;
        parent.appendChild(image);

        if (description)
            this.createDescription({ description, parent })

        return parent;
    }


    /**
     * @param {Object} options
     * @param {string} options.file
     */
    createFrameElement({ file }) {
        if (!file) return null;
        const element = this.#createElement();

        const frame = document.createElement('iframe');
        frame.classList.add('b-frame');
        frame.src = `database/${this.projectId}/${file}/$`;
        element.appendChild(frame);

        const link = document.createElement('a');
        link.innerText = 'here';
        link.href = frame.src;

        const inner = document.createElement('p');
        inner.append( 'Your browser does not support iframes. You can view the content ', link, '.');
        frame.appendChild(inner);

        FrameHandler.handle(frame);

        return element;
    }

    /**
     * @param {Object} options
     * @param {string} options.file
     * @param {string} options.type
     * @param {Object} options.extras
     */
    createTableElement({ file, type, extras }) {
        if (!file) return null;
        const element = this.#createElement();
        
        const table = document.createElement('table');
        table.classList.add('b-table');
        table.setAttribute('aria-table', `database/${this.projectId}/${file}/$`);
        table.setAttribute('aria-filetype', type);
        
        table.toggleAttribute('aria-row-index', extras?.index === true);
        if (Array.isArray(extras?.column_order))
            table.setAttribute('aria-column-order', extras.column_order.join());
            
        element.appendChild(table);



        TableHandler.fromElement(table);

        return element;

        // <span class="draggable b-table" draggable="true">
        //     <table aria-table="database/{{project.project}}/{{element.file}}/$" aria-filetype="{{element.type}}"></table>
        // </span>
    }

}
