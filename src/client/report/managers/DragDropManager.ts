import type { ReportBuilder } from '../ReportBuilder.ts';
import { isDescendant, iterateGroups } from '../utils/groupTree.ts';

export class DragDropManager {
  private report: ReportBuilder;

  constructor(report: ReportBuilder) {
    this.report = report;
  }

  attachGroupEvents(groupId: string) {
    const groupManager = this.report.getGroupManager();
    const insertManager = this.report.getPendingInsertManager();
    const elementManager = this.report.getElementManager();
    const layoutManager = this.report.getLayoutManager();

    const groupRenderer = groupManager.getRenderer();
    const $group = groupManager.getGroup(groupId);
    if (!$group) throw Error("Couldn't find group: " + groupId);

    const { menuEntry: menu, content: group } = $group;

    menu.addEventListener('dragstart', (event) => {
      const dataTransfer = event.dataTransfer;
      dataTransfer?.setData('text/group-id', groupId);
      this.report.toggleFrames(false);
    });

    group.addEventListener('dragstart', (_event) => {
      layoutManager.toggleScrolling(true);
      this.report.toggleFrames(false);
    });

    menu.addEventListener('dragend', (_event) => {
      this.report.toggleFrames(true);
    });

    group.addEventListener('dragend', (_event) => {
      layoutManager.toggleScrolling(false);
      this.report.toggleFrames(true);
    });

    menu.addEventListener('dragover', (event) => {
      event.preventDefault();
      groupRenderer.toggleDragEffect(groupId, true);
    });

    group.addEventListener('dragover', (event) => {
      event.preventDefault();
      groupRenderer.toggleDragEffect(groupId, true);

      // const elementId = event.dataTransfer.getData('text/element-id');
      // if (!elementId) return;

      // const children = [ ...group.querySelectorAll('.b-element')];
      // this.#insertIndex = children.length;

      // for (let i = 0; i < children.length; i++) {
      //     const child = children[i];

      //     if (child.getAttribute('aria-identifier') === elementId)
      //         continue;

      //     const rect = child.getBoundingClientRect();
      //     const midpoint = rect.top + rect.height / 2;

      //     if (event.clientY < midpoint) {
      //         this.#insertIndex = i;
      //         break;
      //     }
      // }

      // insertManager.setInsertMarker(groupId, this.#insertIndex);
    });

    menu.addEventListener('dragleave', (event) => {
      if (!group.contains(event.relatedTarget as Node)) insertManager.removeInsertMarker();
      groupRenderer.toggleDragEffect(groupId, false);
    });

    group.addEventListener('dragleave', (event) => {
      event.preventDefault();
      groupRenderer.toggleDragEffect(groupId, false);
    });

    menu.addEventListener('drop', (event) => {
      event.preventDefault();
      groupRenderer.toggleDragEffect(groupId, false);

      const elementId = event.dataTransfer?.getData('text/element-id');
      const sourceGroupId = event.dataTransfer?.getData('text/source-group-id');

      if (elementId && sourceGroupId) {
        const targetGroupId = groupId;
        // const insertIndex = this.#insertIndex ?? 0;

        elementManager.moveElementToGroup(elementId, sourceGroupId, targetGroupId);
        insertManager.removeInsertMarker();
        return;
      }

      const targetId = groupId;
      const sourceId = event.dataTransfer?.getData('text/group-id');
      if (!sourceId || sourceId === targetId) return;
      if (isDescendant(groupManager, sourceId, targetId)) return;

      const rect = menu.getBoundingClientRect();
      const offsetY = event.clientY - rect.top;
      const ratio = offsetY / rect.height;

      const position = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside';

      groupManager.moveGroup(sourceId, targetId, position);
    });

    group.addEventListener('drop', (event) => {
      event.preventDefault();
      groupRenderer.toggleDragEffect(groupId, false);
      layoutManager.toggleScrolling(false);

      const elementId = event.dataTransfer?.getData('text/element-id');
      const sourceGroupId = event.dataTransfer?.getData('text/source-group-id');
      if (!elementId || !sourceGroupId) return;

      const $group = groupManager.getGroup(groupId);
      if (!$group) return;

      const { elements: children } = $group;
      const { clientY: mouseY } = event;

      for (let index = 0; index < children.length; index++) {
        const { node: child } = children[index];
        /** @type { DOMRect } */
        const { top, bottom, height } = child.getBoundingClientRect();
        if (child.getAttribute('aria-identifier') === elementId) continue;

        /** 2 * 5rem = 80px */
        const selectionSize = Math.min(height / 2, 80);

        const outOfBounds = mouseY < top || mouseY > bottom;
        const withinTop = mouseY <= top + selectionSize;
        const withinBottom = mouseY > bottom - selectionSize ? 1 : 0;

        if (outOfBounds) continue;
        else if (withinTop || withinBottom)
          elementManager.moveElementToGroup(
            elementId,
            sourceGroupId,
            groupId,
            index + withinBottom,
          );
        break;
      }

      // const insertIndex = this.#insertIndex ?? 0;
      // elementManager.moveElementToGroup(elementId, sourceGroupId, groupId, insertIndex);

      insertManager.removeInsertMarker();
    });
  }

  /**
   * @param {string} elementId
   */
  attachElementEvents(elementId: string) {
    const groupManager = this.report.getGroupManager();
    const elementManager = this.report.getElementManager();
    const elementRenderer = elementManager.getRenderer();
    const $element = elementManager.getElement(elementId);
    if (!$element) throw new Error("Couldn't find element: " + elementId);

    const { node: element } = $element;

    element.addEventListener('dragover', (_event) => {
      elementRenderer.toggleInsertionOverlay(elementId, true);
    });

    element.addEventListener('dragleave', (_event) => {
      elementRenderer.toggleInsertionOverlay(elementId, false);
    });

    element.addEventListener('dragstart', (event) => {
      let groupId = '';

      iterateGroups(groupManager, 0, ({ identifier, elements }) => {
        const inGroup = elements.some(({ identifier }) => identifier === elementId);
        if (!inGroup) return true;
        groupId = identifier;
        return false;
      });

      if (groupId === '') return;

      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer?.setData('text/element-id', elementId);
      event.dataTransfer?.setData('text/source-group-id', groupId);
      elementRenderer.toggleDragEffect(elementId, true);
      elementRenderer.toggleOverlay(true);
    });

    element.addEventListener('dragend', () => {
      elementRenderer.toggleDragEffect(elementId, false);
      elementRenderer.toggleOverlay(false);
      // insertManager.removeInsertMarker();
    });
  }
}
