import { DragDropManager } from './managers/DragDropManager.js';
import { ElementManager } from './managers/ElementManager.js';
import { GroupManager } from './managers/GroupManager.js';
import { LayoutManager } from './managers/LayoutManager.js';
import { PendingInsertManager } from './managers/PendingInsertManager.js';

export class ReportBuilder extends EventTarget {
  /** @type {string} */
  #title;

  /** @type {string} */
  #project;

  /** @type { LayoutManager } */
  #layout = null;

  /** @type { GroupManager } */
  #groups = null;

  /** @type { ElementManager } */
  #elements = null;

  /** @type { PendingInsertManager } */
  #insert = null;

  /** @type { DragDropManager } */
  #dragdrop = null;

  /**
   * @param {Object} options
   * @param {string} options.title
   * @param {string} options.project
   * @param {any[]} options.groups
   * @param {HTMLElement} parent
   */
  constructor({ title, project, groups = [] }, parent = document.body) {
    super();

    this.#title = title;
    this.#project = project;

    this.#layout = new LayoutManager(this, parent);
    this.#groups = new GroupManager(this);
    this.#elements = new ElementManager(this);
    this.#insert = new PendingInsertManager(this);
    this.#dragdrop = new DragDropManager(this);

    for (const group of groups) this.#groups.create(group);
  }

  getProjectTitle() {
    return this.#title;
  }

  getProjectId() {
    return this.#project;
  }

  getDragDropManager() {
    return this.#dragdrop;
  }

  getElementManager() {
    return this.#elements;
  }

  getGroupManager() {
    return this.#groups;
  }

  getLayoutManager() {
    return this.#layout;
  }

  getPendingInsertManager() {
    return this.#insert;
  }

  /**
   * @param {boolean} force
   */
  toggleFrames(force = null) {
    if (force == null) force = document.body.classList.contains('local');
    document.body.classList.toggle('local', !force);
  }

  /**
   * @param {Object} options
   * @param {string} options.title
   * @param {any[]} options.elements
   * @param {string} [options.identifier]
   * @param {string} [options.parentId]
   */
  withGroup(options) {
    return this.groups.create(options);
  }

  addElementToGroup(groupId, options) {
    return this.#elements.addElementToGroup(groupId, options);
  }

  destroy() {
    this.#dragdrop.destroy();
    this.#layout.destroy();
  }

  emit(type, detail = {}) {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail: {
          report: this,
          timestamp: Date.now(),
          ...detail,
        },
      }),
    );
  }
}
