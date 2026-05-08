
export class ReportBuilder {

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

        if (groups !== null)
            for (const group of groups)
                report.withGroup(group);

        return report;
    }

    /**
     * @param {Object} options 
     * @param {string} options.title
     * @param {any[]} options.elements
     */
    withGroup({ title, elements = [] }) {



        console.log(title);
        console.log(elements);
    }

    #createElement() {
        const div = document.createElement('div');
        div.classList.add('b-element');
        return div;
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
    createFrame({ file }) {
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

        return element;
    }

}
