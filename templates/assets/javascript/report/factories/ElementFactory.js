import { EditorToolbar } from "../../editor/editorToolbar.js";
import { ReportElement } from "../models/ReportElement.js";
import { createIdentifier } from "../utils/identifiers.js";
import { createProseMirrorEditor } from "../../editor/prosemirrorEditor.js";
import { FrameHandler } from "../../iframe.js";
import { TableHandler } from "../../table.js";
import { ReportBuilder } from "../ReportBuilder.js";

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

    #createElementShell(identifier) {
        const element = document.createElement('div');
        element.classList.add('b-element');
        element.setAttribute('aria-identifier', identifier);
        element.draggable = true;

        return element;
    }

    createElementFromType(options, edit = false) {
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
    createDescription({ description = 'Sample description', identifier = createIdentifier() }, edit = false) {
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

        this.#toolbar.bind(view);

        return element;
    }

    /**
     * @param {Object} options
     * @param {boolean} edit 
     */
    createImageElement({ file, description, identifier = createIdentifier() }, edit = false) {
        if (!file) return null;
        const project = this.#report.getProjectId();

        const shell = this.#createElementShell(identifier);
        const image = document.createElement('img');
        image.classList.add('b-image');
        image.src = `database/${project}/${file}/$`;
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
        }

        return element;
    }

    /**
     * @param {Object} options
     * @param {boolean} edit 
     */
    createFrameElement({ file, identifier = createIdentifier() }, edit = false) {
        if (!file) return null;
        const project = this.#report.getProjectId();

        const shell = this.#createElementShell(identifier);
        const frame = document.createElement('iframe');
        frame.classList.add('b-frame');
        frame.src = `database/${project}/${file}/$`;
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
    createTableElement({ file, type, extras, identifier = createIdentifier() }, edit = false) {
        if (!file) return null;
        const project = this.#report.getProjectId();

        const shell = this.#createElementShell(identifier);
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
            id: identifier,
            type: 'table',
            node: shell,
            data: { file, type, extras }
        });
    }

}
