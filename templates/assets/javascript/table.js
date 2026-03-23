/** @type { HTMLTableElement[] } */
const tables = [...document.querySelectorAll('div')];

for (const table of tables) {
    const ariaTableAttr = table.attributes.getNamedItem('aria-table');
    if (ariaTableAttr == null) continue;

    const ariaFileTypeAttr = table.attributes.getNamedItem('aria-filetype');
    const fileType = ariaFileTypeAttr.nodeValue || 'csv';

    const url = new URL(ariaTableAttr.nodeValue, table.baseURI);
    loadTable(table, url, fileType);
}

/**
 * @param {HTMLTableElement} element 
 * @param {URL} url 
 * @param {string} type 
 */
function loadTable(element, url, type) {
    (async () => {
        const response = await fetch(url);
        return await response.text();
    })().then(data => {

        let content;

        switch (type) {
            case 'csv':
                content = loadCSVTable(data);
        }

        new TableHandler(element, content)
            .maxRows(15).load();
    })
}

/**
 * @param {HTMLTableElement} element 
 * @param {string} data 
 */
function loadCSVTable(data) {
    return data.split("\n")
        .filter(line => !line.match(/^$/g))
        .map(line => line.split(/(?<=(?:^|,)(?:"(?:""|[^"])*"|[^"]+)),(?![^"]+",)/g)
            .map(d =>
                (d.match(/^\d+(?:\.\d+)?$/))
                    ? parseFloat(d)
                    : d.replaceAll(/^"|"$/g, "").replaceAll(/""/g, "\"")
            )
        );
}

class TableHandler {
    /**
     * @param {HTMLElement} element 
     * @param {Object[][]} data 
     */
    constructor(element, data) {
        this.data = data.slice(1);

        this.#createActions(element)
            .#makeHeaders(data[0])
            .maxRows(10);
    }

    /**
     * @param {number} rows Rows to display
     * @returns {TableHandler}
     */
    maxRows(rows) {
        this.rows = Math.max(rows, 10);
        this.max_pages = Math.floor(this.data.length / this.rows);

        const existing = [...this.element.querySelectorAll('.table-row.row')];
        const toAdd = Math.max(this.rows - existing.length, 0);

        // Remove overflowing elements
        existing.slice(rows).forEach(e => e.remove());

        // Add new elements
        new Array(toAdd).fill("div")
            .map(document.createElement, document)
            .map((e, i) => { 
                e.classList.add('table-row','row');
                return e;
            }).forEach(this.element.appendChild, this.element);

        return this;
    }

    /**
     * @param {Number} page 
     * @returns {TableHandler}
     */
    load(page = 0) {
        this.page = page;
        var offset = page * this.rows;

        const existing = [...this.element.querySelectorAll('.table-row.row')];

        const selected = this.data.slice(offset, offset + this.rows);

        selected.forEach((row, i) => {
            const rowElement = existing[i];
            const columns = [...rowElement.querySelectorAll('.table-entry .entry-text')];

            row.forEach((data, j) => {
                if (columns[j] == null)
                    rowElement.appendChild(this.#createEntry(data));
                else columns[j].innerText = data;
            });
        });

        if (selected.length < this.rows) {
            existing.slice(selected.length).forEach(row => {
                row.querySelectorAll('.table-entry .entry-text').forEach(column => {
                    column.innerText = "";
                });
            });
        }

        this.page_display.innerText = `Page: ${this.page + 1}/${this.max_pages + 1}`;
        return this;
    }

    /**
     * @param {String} content 
     * @returns {HTMLElement}
     */
    #createEntry(content) {
        const entry = document.createElement('span');
        entry.classList.add('table-entry');
        
        const holder = document.createElement('p');
        holder.classList.add('entry-text');
        holder.innerText = content;

        entry.appendChild(holder);
        return entry;
    }

    /**
     * @param {Event} event 
     * @returns {TableHandler}
     */
    #searchEvent(event) {

        return this;
    }

    /**
     * 
     * @param {Number} offset 
     * @returns {TableHandler}
     */
    #paginate(offset = 0) {
        const page = Math.min(
            // Make greater than 0
            Math.max(this.page + offset, 0),
            // Make less than max pages
            this.max_pages
        );

        return this.load(page);
    }

    /**
     * @param {HTMLElement} element
     * @returns {TableHandler}
     */
    #createActions(element) {
        const [
            SEARCH_LABEL, SEARCH, CONTROLS, TABLE, PAGE_DISPLAY,
            FAST_BACKWARDS, BACK, FORWARD, FAST_FORWARDS
        ] = [
            'label', 'input', 'span', 'div', 'span',
            'span', 'span', 'span', 'span'
        ].map(document.createElement, document);

        SEARCH_LABEL.append("Search: ");
        SEARCH_LABEL.appendChild(SEARCH);
        SEARCH_LABEL.classList.add('table-search');

        SEARCH.addEventListener('change', (event) => this.#searchEvent(event));

        CONTROLS.appendChild(FAST_BACKWARDS);
        CONTROLS.appendChild(BACK);
        CONTROLS.appendChild(PAGE_DISPLAY);
        CONTROLS.appendChild(FORWARD);
        CONTROLS.appendChild(FAST_FORWARDS);
        CONTROLS.classList.add('table-controls');

        FAST_BACKWARDS.addEventListener('click', (event) => this.#paginate(Number.NEGATIVE_INFINITY));
        FAST_BACKWARDS.classList.add('control-clickable');
        FAST_BACKWARDS.append("Start")

        BACK.addEventListener('click', (event) => this.#paginate(-1));
        BACK.classList.add('control-clickable');
        BACK.append("Prev")

        FORWARD.addEventListener('click', (event) => this.#paginate(1));
        FORWARD.classList.add('control-clickable');
        FORWARD.append("Next")

        FAST_FORWARDS.addEventListener('click', (event) => this.#paginate(Number.POSITIVE_INFINITY));
        FAST_FORWARDS.classList.add('control-clickable');
        FAST_FORWARDS.append("End")


        this.page_display = PAGE_DISPLAY;
        this.element = TABLE;

        TABLE.classList.add('g-table');

        element.appendChild(SEARCH_LABEL);
        element.appendChild(TABLE);
        element.appendChild(CONTROLS);

        return this;
    }

    /**
     * @param {Object[]} headers 
     * @returns {TableHandler}
     */
    #makeHeaders(headers) {
        this.columns = headers?.length || 0;

        this.element.style.setProperty('--cols', this.columns);

        const header = document.createElement('div');
        header.classList.add('table-row', 'header');
        this.element.appendChild(header);

        headers.map(this.#createEntry, this)
            .forEach(header.appendChild, header);

        return this;
    }

}



// <span class="draggable b-table" draggable="true">
//     <table aria-table="database/{{project.project}}/{{element.file}}/$" aria-filetype="{{element.type}}"></table>
// </span>

