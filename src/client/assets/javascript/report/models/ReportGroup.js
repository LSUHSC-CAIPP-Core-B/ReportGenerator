export class ReportGroup {
  /**
   * @param {Object} options
   * @param {string} options.identifier
   * @param {string} options.title
   * @param {HTMLElement} options.menuEntry
   * @param {HTMLElement} options.content
   * @param {string} [options.parentId]
   * @param {number} [options.depth]
   */
  constructor({ identifier, title, menuEntry, content, parentId = null, depth = 0 }) {
    this.identifier = identifier;
    this.title = title;

    this.parentId = parentId;
    this.depth = depth;

    this.collapsed = false;

    this.menuEntry = menuEntry;
    this.content = content;

    /** @type {ReportElement[]} */
    this.elements = [];
  }
}
