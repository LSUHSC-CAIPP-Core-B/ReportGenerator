import { ReportBuilder } from '../ReportBuilder.js';
import { isDescendant, iterateGroups } from '../utils/groupTree.js';

export class DragDropManager {
  /** @type {ReportBuilder} */
  #report;

  /**
   * @param {ReportBuilder} report
   */
  constructor(report) {
    this.#report = report;
  }

  /**
   * @param {string} groupId
   */
  attachGroupEvents(groupId) {
    const groupManager = this.#report.getGroupManager();
    const insertManager = this.#report.getPendingInsertManager();
    const elementManager = this.#report.getElementManager();
    const layoutManager = this.#report.getLayoutManager();

    const groupRenderer = groupManager.getRenderer();

    const { menuEntry: menu, content: group } = groupManager.getGroup(groupId);

    menu.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/group-id', groupId);
      this.#report.toggleFrames(false);
    });

    group.addEventListener('dragstart', (_event) => {
      layoutManager.toggleScrolling(true);
      this.#report.toggleFrames(false);
    });

    menu.addEventListener('dragend', (_event) => {
      this.#report.toggleFrames(true);
    });

    group.addEventListener('dragend', (_event) => {
      layoutManager.toggleScrolling(false);
      this.#report.toggleFrames(true);
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
      if (!group.contains(event.relatedTarget)) insertManager.removeInsertMarker();
      groupRenderer.toggleDragEffect(groupId, false);
    });

    group.addEventListener('dragleave', (event) => {
      event.preventDefault();
      groupRenderer.toggleDragEffect(groupId, false);
    });

    menu.addEventListener('drop', (event) => {
      event.preventDefault();
      groupRenderer.toggleDragEffect(groupId, false);

      const elementId = event.dataTransfer.getData('text/element-id');
      const sourceGroupId = event.dataTransfer.getData('text/source-group-id');

      if (elementId && sourceGroupId) {
        const targetGroupId = groupId;
        // const insertIndex = this.#insertIndex ?? 0;

        elementManager.moveElementToGroup(elementId, sourceGroupId, targetGroupId);
        insertManager.removeInsertMarker();
        return;
      }

      const targetId = groupId;
      const sourceId = event.dataTransfer.getData('text/group-id');
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

      const elementId = event.dataTransfer.getData('text/element-id');
      const sourceGroupId = event.dataTransfer.getData('text/source-group-id');
      if (!elementId || !sourceGroupId) return;

      const { elements: children } = groupManager.getGroup(groupId);

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
        const withinBottom = mouseY > bottom - selectionSize;

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
  attachElementEvents(elementId) {
    const groupManager = this.#report.getGroupManager();
    const elementManager = this.#report.getElementManager();
    const elementRenderer = elementManager.getRenderer();

    const { node: element } = elementManager.getElement(elementId);

    element.addEventListener('dragover', (_event) => {
      elementRenderer.toggleInsertionOverlay(elementId, true);
    });

    element.addEventListener('dragleave', (_event) => {
      elementRenderer.toggleInsertionOverlay(elementId, false);
    });

    element.addEventListener('dragstart', (event) => {
      let groupId = null;

      iterateGroups(groupManager, 0, ({ identifier, elements }) => {
        const inGroup = elements.some(({ identifier }) => identifier === elementId);
        if (!inGroup) return true;
        groupId = identifier;
        return false;
      });

      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/element-id', elementId);
      event.dataTransfer.setData('text/source-group-id', groupId);
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
