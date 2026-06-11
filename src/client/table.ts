import type { TableData } from '../shared/types.ts';
import { querySelectorAll } from './utils.ts';

function loadCSVTable(data: string) {
  return data
    .split('\n')
    .filter((line) => !line.match(/^$/g))
    .map((line) =>
      line
        .split(/(?<=(?:^|,)(?:"(?:""|[^"])*"|[^"]+)),(?![^"]+",)/g)
        .map((d) =>
          d.match(/^\d+(?:\.\d+)?$/)
            ? parseFloat(d)
            : d.replaceAll(/^"|"$/g, '').replaceAll(/""/g, '"'),
        ),
    );
}

export class TableHandler {
  data: TableData[];
  initial_data: TableData[];

  rows!: number;
  columns!: number;
  page: number = 0;
  max_pages!: number;

  element!: HTMLElement;
  sort_direction!: number;

  page_display?: any;
  prev_column_sort?: any;
  column_sort?: any;

  static async fromElement(element: HTMLTableElement) {
    const ariaTableAttr = element.attributes.getNamedItem('aria-table');
    if (ariaTableAttr == null) return;

    const url = new URL(ariaTableAttr.nodeValue ?? '', element.baseURI);
    const ariaFileTypeAttr = element.attributes.getNamedItem('aria-filetype');
    const fileType = ariaFileTypeAttr?.nodeValue || 'csv';

    const response = await fetch(url);
    const data = await response.text();
    let content: TableData[];

    if (fileType === 'csv') content = loadCSVTable(data);
    else return null;

    return new TableHandler(element, content).maxRows(15).load();
  }

  constructor(element: HTMLElement, data: TableData[]) {
    const orderStr = element.attributes.getNamedItem('aria-column-order')?.value;
    const indexRows = element.attributes.getNamedItem('aria-row-index') != null;

    const order = orderStr?.split(',')?.map((o) => Number.parseInt(o, 10));
    let mapped_data = this.reorderData(data, order);
    if (indexRows) mapped_data = this.indexData(mapped_data);

    this.data = mapped_data.slice(1);
    this.initial_data = this.data;

    const headers = mapped_data[0];
    if (indexRows) headers[0] = 'INDEX';

    this.createActions(element).makeHeaders(headers).maxRows(10);
  }

  maxRows(rows: number) {
    this.rows = Math.max(rows, 10);
    this.max_pages = Math.floor(this.data.length / this.rows);

    const existing = [...this.element.querySelectorAll('.table-row.row')];
    const toAdd = Math.max(this.rows - existing.length, 0);

    // Remove overflowing elements
    existing.slice(rows).forEach((e) => {
      e.remove();
    });

    // Add new elements
    new Array(toAdd)
      .fill('div')
      .map((e) => document.createElement(e), document)
      .map((e, _i) => {
        e.classList.add('table-row', 'row');
        return e;
      })
      .forEach(this.element.appendChild, this.element);

    return this;
  }

  load(page: number = 0): TableHandler {
    this.rows ??= 15;

    this.page = page;
    var offset = page * this.rows;

    const existing = querySelectorAll(this.element, '.table-row.row');

    const selected = this.data.slice(offset, offset + this.rows);

    selected.forEach((row, i) => {
      const rowElement = existing[i];
      const columns = querySelectorAll(rowElement, '.table-entry .entry-text');

      row.forEach((data, j) => {
        if (columns[j] == null) rowElement.appendChild(this.createEntry(data));
        else columns[j].innerText = data.toString();
      });
    });

    if (selected.length < this.rows) {
      existing.slice(selected.length).forEach((row) => {
        querySelectorAll(row, '.table-entry .entry-text').forEach((column) => {
          column.innerText = '';
        });
      });
    }

    this.page_display.innerText = `Page: ${this.page + 1}/${this.max_pages + 1}`;
    return this;
  }

  private createEntry(content: string | number): HTMLElement {
    const entry = document.createElement('span');
    entry.classList.add('table-entry');

    const holder = document.createElement('p');
    holder.classList.add('entry-text');
    holder.innerText = content.toString();

    entry.appendChild(holder);
    return entry;
  }

  private searchEvent(event: Event): TableHandler {
    const element: HTMLInputElement = event.target as HTMLInputElement;
    const searchStr = element.value;

    const escaped = RegExp.escape(searchStr.toLowerCase());
    const search = new RegExp(escaped, 'gi');

    this.data = this.initial_data.filter((row) => {
      return row
        .map((data) => data.toString().match(search))
        .reduce((a, b) => a || b != null, false);
    });

    this.max_pages = Math.floor(this.data.length / this.rows);

    // Reload the page
    return this.load();
  }

  private sort(event: Event): TableHandler {
    const element: HTMLElement = event.target as HTMLElement;
    const parent = element.parentElement;

    const parentNode = parent?.getAttributeNode('aria-column');
    const attr = parentNode || element.getAttributeNode('aria-column');

    const target = !parentNode ? element : parent;
    if (!target) throw new Error("Parent couldn't be found");

    const children = target.parentElement?.children ?? [];

    [...children].forEach((child) => {
      child.classList.toggle('sort-desc', false);
      child.classList.toggle('sort-asce', false);
    });

    // sort-des

    this.prev_column_sort = this.column_sort;
    this.column_sort = Number.parseInt(attr?.value || '0', 10);
    this.sort_direction = this.prev_column_sort === this.column_sort ? -this.sort_direction : 1;

    target.classList.toggle('sort-desc', this.sort_direction === 1);
    target.classList.toggle('sort-asce', this.sort_direction === -1);

    this.data = this.data.sort((r1, r2) =>
      r1[this.column_sort] < r2[this.column_sort]
        ? -this.sort_direction
        : r1[this.column_sort] > r2[this.column_sort]
          ? this.sort_direction
          : 0,
    );

    // Reload the page
    return this.load(this.page);
  }

  private paginate(offset: number = 0): TableHandler {
    const page = Math.min(
      // Make greater than 0
      Math.max(this.page + offset, 0),
      // Make less than max pages
      this.max_pages,
    );

    return this.load(page);
  }

  private createActions(element: HTMLElement): TableHandler {
    const [
      SEARCH_LABEL,
      SEARCH,
      CONTROLS,
      TABLE,
      PAGE_DISPLAY,
      FAST_BACKWARDS,
      BACK,
      FORWARD,
      FAST_FORWARDS,
    ] = ['label', 'input', 'span', 'div', 'span', 'span', 'span', 'span', 'span'].map(
      (e) => document.createElement(e),
      document,
    );

    SEARCH_LABEL.append('Search: ');
    SEARCH_LABEL.appendChild(SEARCH);
    SEARCH_LABEL.classList.add('table-search');

    SEARCH.addEventListener('input', (event) => this.searchEvent(event));

    CONTROLS.appendChild(FAST_BACKWARDS);
    CONTROLS.appendChild(BACK);
    CONTROLS.appendChild(PAGE_DISPLAY);
    CONTROLS.appendChild(FORWARD);
    CONTROLS.appendChild(FAST_FORWARDS);
    CONTROLS.classList.add('table-controls');

    FAST_BACKWARDS.addEventListener('click', (_event) => this.paginate(Number.NEGATIVE_INFINITY));
    FAST_BACKWARDS.classList.add('control-clickable');
    FAST_BACKWARDS.append('Start');

    BACK.addEventListener('click', (_event) => this.paginate(-1));
    BACK.classList.add('control-clickable');
    BACK.append('Prev');

    FORWARD.addEventListener('click', (_event) => this.paginate(1));
    FORWARD.classList.add('control-clickable');
    FORWARD.append('Next');

    FAST_FORWARDS.addEventListener('click', (_event) => this.paginate(Number.POSITIVE_INFINITY));
    FAST_FORWARDS.classList.add('control-clickable');
    FAST_FORWARDS.append('End');

    this.page_display = PAGE_DISPLAY;
    this.element = TABLE;

    TABLE.classList.add('g-table');

    element.appendChild(SEARCH_LABEL);
    element.appendChild(TABLE);
    element.appendChild(CONTROLS);

    return this;
  }

  private makeHeaders(headers: TableData): TableHandler {
    this.columns = headers.length || 0;

    this.element.style.setProperty('--cols', this.columns.toString());

    const header = document.createElement('div');
    header.classList.add('table-row', 'header');
    this.element.appendChild(header);

    headers.map(this.createEntry, this).forEach((column, index) => {
      const attr = document.createAttribute('aria-column');
      attr.value = `${index}`;
      column.attributes.setNamedItem(attr);

      column.addEventListener('click', (event) => this.sort(event));
      header.appendChild(column);
    }, header);

    return this;
  }

  private reorderData(data: TableData[], order: number[] | undefined): TableData[] {
    if (!order) return data;
    return data.map((row) => order.map((o) => row[o]));
  }

  private indexData(data: TableData[]): TableData[] {
    return data.map((row, i) => [i, ...row]);
  }
}
