export class ReportElement {
  /**
   * @param {Object} options
   * @param {string} options.identifier
   * @param {string} options.type
   * @param {HTMLElement} options.node
   * @param {Object} options.data
   */
  constructor({ identifier, type, node, data = {} }) {
    this.identifier = identifier;
    this.type = type;
    this.node = node;
    this.data = data;
  }
}
