import type { ElementOptions } from '../../../shared/types.ts';
import { ElementFactory } from '../factories/ElementFactory.ts';
import type { ReportElement } from '../models/ReportElement.ts';
import type { ReportGroup } from '../models/ReportGroup.ts';
import type { ReportBuilder } from '../ReportBuilder.ts';
import { ElementRenderer } from '../renderers/ElementRenderer.ts';
import { iterateGroups } from '../utils/groupTree.ts';

export class ElementManager {
  private elementFactory: ElementFactory;

  private elements: Map<string, ReportElement> = new Map();
  private report: ReportBuilder;
  private renderer: ElementRenderer;

  constructor(report: ReportBuilder) {
    this.report = report;
    this.elementFactory = new ElementFactory(report);
    this.renderer = new ElementRenderer(this);
  }

  addElementToGroup(groupId: string, options: ElementOptions) {
    return this.insertElementIntoGroup(groupId, options, null);
  }

  insertElementIntoGroup(groupId: string, options: ElementOptions, index: number | null = null) {
    const groupManager = this.report.getGroupManager();
    const dragDropManager = this.report.getDragDropManager();

    const group = groupManager.getGroup(groupId);
    if (!group) return null;

    const element = this.elementFactory.createElementFromType(options);
    if (!element) return null;
    const { identifier } = element;

    if (index == null) index = group.elements.length;

    group.elements.splice(index, 0, element);
    this.elements.set(identifier, element);
    dragDropManager.attachElementEvents(identifier);

    const beforeNode = group.content.children[index];
    if (beforeNode) group.content.insertBefore(element.node, beforeNode);
    else group.content.appendChild(element.node);

    this.report.emit('element:create', {
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
  moveElementToGroup(elementId: string, fromGroupId: string, toGroupId: string, index: number = 0) {
    const groupManager = this.report.getGroupManager();

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
    const element: ReportElement = sourceGroup.elements.splice(sourceIndex, 1)[0];
    /** @type {ReportElement} */
    const target: ReportElement = targetGroup.elements.slice(index)[0];
    targetGroup.elements.splice(index, 0, element);

    if (target) targetGroup.content.insertBefore(element.node, target.node);
    else targetGroup.content.appendChild(element.node);

    this.report.emit('element:move', {
      elementId,
      fromGroupId,
      index,
      toGroupId,
    });
  }

  deleteElement(elementId: string) {
    let groupId: string = '';
    let element: ReportElement | null = null;

    iterateGroups(this.report.getGroupManager(), 0, (group) => {
      const idx = group.elements.findIndex((e) => e.identifier === elementId);

      if (idx !== -1) {
        groupId = group.identifier;
        element = group.elements[idx];
        group.elements.splice(idx, 1);
        return false;
      }
    });

    if (element == null) return;

    (element as ReportElement).node.remove();
    this.elements.delete(elementId);

    this.report.emit('element:delete', {
      elementId,
      groupId,
    });
  }

  /**
   * Get element from id
   */
  getElement(elementId: string): ReportElement | undefined {
    return this.elements.get(elementId);
  }

  /**
   * Check if element exists from id
   */
  hasElement(elementId: string): boolean {
    return this.elements?.has(elementId);
  }

  iterateElements(callback: (element: ReportElement) => void) {
    for (const element of this.elements.values()) callback(element);
  }

  toJSON() {
    const project = this.report.getProjectId();
    const groups: ReportGroup[] = [];

    iterateGroups(this.report.getGroupManager(), 0, (group) => {
      groups.push(group);
    });

    return { groups, project };
  }

  getRenderer() {
    return this.renderer;
  }
}
