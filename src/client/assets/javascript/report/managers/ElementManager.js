import { ElementFactory } from '../factories/ElementFactory.js';
import { ReportElement } from '../models/ReportElement.js';
import { ReportBuilder } from '../ReportBuilder.js';
import { ElementRenderer } from '../renderers/ElementRenderer.js';
import { iterateGroups } from '../utils/groupTree.js';

export class ElementManager {
  /** @type {ElementFactory} */
  #elementFactory;

  /** @type {Map<string, ReportElement>} */
  #elements = new Map();

  /** @type {ReportBuilder} */
  #report;
  /** @type {ElementRenderer} */
  #renderer;

  /**
   * @param {ReportBuilder} report
   */
  constructor(report) {
    this.#report = report;
    this.#elementFactory = new ElementFactory(report);
    this.#renderer = new ElementRenderer(this);
  }

  /**
   * @param {string} groupId
   * @param {Object} options
   */
  addElementToGroup(groupId, options) {
    return this.insertElementIntoGroup(groupId, options, null, false);
  }

  /**
   * @param {string} groupId
   * @param {Object} options
   * @param {number} [index]
   */
  insertElementIntoGroup(groupId, options, index = null, edit = false) {
    const groupManager = this.#report.getGroupManager();
    const dragDropManager = this.#report.getDragDropManager();

    const group = groupManager.getGroup(groupId);
    if (!group) return null;

    const element = this.#elementFactory.createElementFromType(options, edit);
    if (!element) return null;
    const { identifier } = element;

    if (index == null) index = group.elements.length;

    group.elements.splice(index, 0, element);
    this.#elements.set(identifier, element);
    dragDropManager.attachElementEvents(identifier);

    const beforeNode = group.content.children[index];
    if (beforeNode) group.content.insertBefore(element.node, beforeNode);
    else group.content.appendChild(element.node);

    this.#report.emit('element:create', {
      groupId,
      index,
      options: element,
    });

    return element;
  }

  /**
   * @param {string} elementId
   * @param {string} fromGroupId
   * @param {string} toGroupId
   * @param {number} index
   */
  moveElementToGroup(elementId, fromGroupId, toGroupId, index = 0) {
    const groupManager = this.#report.getGroupManager();

    const sourceGroup = groupManager.getGroup(fromGroupId);
    const targetGroup = groupManager.getGroup(toGroupId);

    if (!sourceGroup || !targetGroup) return;
    const sourceIndex = sourceGroup.elements.findIndex(
      ({ identifier }) => identifier === elementId,
    );

    if (fromGroupId === toGroupId)
      if (sourceIndex === index) return;
      else if (sourceIndex < index) index--;

    /** @type {ReportElement} */
    const element = sourceGroup.elements.splice(sourceIndex, 1)[0];
    /** @type {ReportElement} */
    const target = targetGroup.elements.slice(index)[0];
    targetGroup.elements.splice(index, 0, element);

    if (target) targetGroup.content.insertBefore(element.node, target.node);
    else targetGroup.content.appendChild(element.node);

    this.#report.emit('element:move', {
      elementId,
      fromGroupId,
      index,
      toGroupId,
    });
  }

  deleteElement(elementId) {
    let groupId = null;
    let element = null;

    iterateGroups(this.#report.getGroupManager(), 0, (group) => {
      const idx = group.elements.findIndex((e) => e.identifier === elementId);

      if (idx !== -1) {
        groupId = group.identifier;
        element = group.elements.splice(idx, 1)[0];
        return false;
      }
    });

    if (!element) return;

    element.node.remove();
    this.#elements.delete(elementId);

    this.#report.emit('element:delete', {
      elementId,
      groupId,
    });
  }

  /**
   * Get element from id
   * @param {string} elementId
   * @returns {ReportElement}
   */
  getElement(elementId) {
    return this.#elements?.get(elementId);
  }

  /**
   * Check if element exists from id
   * @param {string} elementId
   * @returns {boolean}
   */
  hasElement(elementId) {
    return this.#elements?.has(elementId);
  }

  /**
   * @param {(element: ReportElement) => void} callback
   */
  iterateElements(callback) {
    for (const element of this.#elements.values()) callback(element);
  }

  toJSON() {
    const project = this.#report.getProjectId();
    const groups = [];

    iterateGroups(this.#report.getGroupManager(), 0, (group) => groups.push(group));

    return { groups, project };
  }

  getRenderer() {
    return this.#renderer;
  }
}
