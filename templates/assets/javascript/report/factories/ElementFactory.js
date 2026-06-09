import { EditorToolbar } from '../../editor/editorToolbar.js';
import { createProseMirrorEditor } from '../../editor/prosemirrorEditor.js';
import { handle } from '../../iframe.js';
import { TableHandler } from '../../table.js';
import { ReportElement } from '../models/ReportElement.js';
import { ReportBuilder } from '../ReportBuilder.js';
import { createIdentifier } from '../utils/identifiers.js';

export class ElementFactory {
  #toolbar = new EditorToolbar();

  /** @type {ReportBuilder} */
  #report;

  /**
   * @param {ReportBuilder} report
   */
  constructor(report) {
    this.#report = report;
  }

  #createElementShell({ identifier, icon = 'group', details = 'Element Group' }) {
    const element = document.createElement('div');
    element.classList.add('b-element');
    element.setAttribute('aria-identifier', identifier);
    element.draggable = true;

    const descriptionEl = document.createElement('span');
    descriptionEl.classList.add('desc-block');
    element.appendChild(descriptionEl);

    const iconEl = document.createElement('i');
    iconEl.classList.add('desc-icon', `icon-${icon}`);
    descriptionEl.appendChild(iconEl);

    const textEl = document.createElement('p');
    textEl.classList.add('desc-text');
    textEl.innerText = details;
    descriptionEl.appendChild(textEl);

    const beforeEl = document.createElement('span');
    beforeEl.classList.add('insertion', 'before');
    descriptionEl.appendChild(beforeEl);

    const afterEl = document.createElement('span');
    afterEl.classList.add('insertion', 'after');
    descriptionEl.appendChild(afterEl);

    return element;
  }

  createElementFromType(options) {
    const { type } = options;

    if (type === 'description') return this.createDescription(options);
    else if (type === 'frame') return this.createFrameElement(options);
    else if (type === 'image') return this.createImageElement(options);
    else if (type === 'table') return this.createTableElement(options);

    return this.createDescription({
      data: {
        description: `Unsupported element type: ${type}`,
      },
    });
  }

  /**
   * @param {Object} options
   */
  createDescription(options = {}) {
    const { data = {}, identifier = createIdentifier() } = options;
    const { description = 'Sample description' } = data;
    const shell = this.#createElementShell({ details: 'Description', icon: 'text', identifier });
    const mount = document.createElement('div');
    mount.classList.add('pm-mount');
    shell.appendChild(mount);

    const element = new ReportElement({
      data: { description },
      identifier,
      node: shell,
      type: 'description',
    });

    const { view } = createProseMirrorEditor({
      content: description,
      mount,
      onChange: (html) => {
        element.data.description = html;
      },
    });

    this.#toolbar.bind(view);

    return element;
  }

  /**
   * @param {Object} options
   */
  createImageElement(options = {}) {
    const { identifier = createIdentifier(), data } = options;
    const { file, description } = data;

    if (!file) return null;
    const project = this.#report.getProjectId();

    const shell = this.#createElementShell({ icon: 'image', identifier });
    const image = document.createElement('img');
    image.classList.add('b-image');
    image.src = `database/${project}/${file}/$`;
    shell.appendChild(image);

    const element = new ReportElement({
      data: { description, file },
      identifier,
      node: shell,
      type: 'image',
    });

    if (description) {
      const desc = document.createElement('p');
      desc.classList.add('b-description');
      desc.innerText = description;
      shell.appendChild(desc);
    }

    return element;
  }

  /**
   * @param {Object} options
   */
  createFrameElement(options = {}) {
    const { identifier = createIdentifier(), data = {} } = options;
    const { file } = data;

    if (!file) return null;
    const project = this.#report.getProjectId();

    const shell = this.#createElementShell({ icon: 'pointer', identifier });
    const frame = document.createElement('iframe');
    frame.classList.add('b-frame');
    frame.src = `database/${project}/${file}/$`;
    shell.appendChild(frame);

    handle(frame);

    return new ReportElement({
      data: { file },
      identifier,
      node: shell,
      type: 'frame',
    });
  }

  /**
   * @param {Object} options
   */
  createTableElement(options = {}) {
    const { identifier = createIdentifier(), data = {} } = options;
    const { type, file, extras } = data;
    if (!file) return null;
    const project = this.#report.getProjectId();

    const shell = this.#createElementShell({ icon: 'table-2', identifier });
    const table = document.createElement('table');
    table.classList.add('b-table');

    table.setAttribute('aria-table', `database/${project}/${file}/$`);
    table.setAttribute('aria-filetype', type);
    table.toggleAttribute('aria-row-index', extras?.index === true);

    if (Array.isArray(extras?.column_order))
      table.setAttribute('aria-column-order', extras.column_order.join(','));

    TableHandler.fromElement(table);
    shell.appendChild(table);

    return new ReportElement({
      data: { extras, file, type },
      identifier,
      node: shell,
      type: 'table',
    });
  }
}
