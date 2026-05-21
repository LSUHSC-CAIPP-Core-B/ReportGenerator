
export class ReportElement {
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
