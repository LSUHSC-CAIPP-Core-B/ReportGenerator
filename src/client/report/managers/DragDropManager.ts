import type { ReportBuilder } from '../ReportBuilder.ts';
import { isDescendant, iterateGroups } from '../utils/groupTree.ts';

export class DragDropManager {
  private report: ReportBuilder;

  constructor(report: ReportBuilder) {
    this.report = report;
  }

  attachGroupEvents(toGroupId: string) {
    const groupManager = this.report.getGroupManager();
    const insertManager = this.report.getPendingInsertManager();
    const elementManager = this.report.getElementManager();
    const layoutManager = this.report.getLayoutManager();

    const groupRenderer = groupManager.getRenderer();
    const $group = groupManager.getGroup(toGroupId);
    if (!$group) throw Error(`Couldn't find group: ${toGroupId}`);

    const { menuEntry: menu, content: group } = $group;

    menu.addEventListener('dragstart', (event) => {
      const dataTransfer = event.dataTransfer;
      dataTransfer?.setData('text/group-id', toGroupId);
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
      groupRenderer.toggleDragEffect(toGroupId, true);
    });

    group.addEventListener('dragover', (event) => {
      event.preventDefault();
      groupRenderer.toggleDragEffect(toGroupId, true);

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
      groupRenderer.toggleDragEffect(toGroupId, false);
    });

    group.addEventListener('dragleave', (event) => {
      event.preventDefault();
      groupRenderer.toggleDragEffect(toGroupId, false);
    });

    menu.addEventListener('drop', (event) => {
      event.preventDefault();
      groupRenderer.toggleDragEffect(toGroupId, false);

      const elementId = event.dataTransfer?.getData('text/element-id');
      const fromGroupId = event.dataTransfer?.getData('text/source-group-id');

      if (elementId && fromGroupId) {
        // const insertIndex = this.#insertIndex ?? 0;
        elementManager.moveElementToGroup({ elementId, fromGroupId, toGroupId });
        insertManager.removeInsertMarker();
        return;
      }

      const groupId = event.dataTransfer?.getData('text/group-id');
      if (!groupId || groupId === toGroupId) return;
      if (isDescendant(groupManager, groupId, toGroupId)) return;

      const rect = menu.getBoundingClientRect();
      const offsetY = event.clientY - rect.top;
      const ratio = offsetY / rect.height;

      const position = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside';

      groupManager.moveGroup({ groupId, position, targetId: toGroupId });
    });

    group.addEventListener('drop', (event) => {
      event.preventDefault();
      groupRenderer.toggleDragEffect(toGroupId, false);
      layoutManager.toggleScrolling(false);

      const elementId = event.dataTransfer?.getData('text/element-id');
      const fromGroupId = event.dataTransfer?.getData('text/source-group-id');
      if (!elementId || !fromGroupId) return;

      const $group = groupManager.getGroup(toGroupId);
      if (!$group) return;

      const { elements: children } = $group;
      const { clientY: mouseY } = event;

      for (let index = 0; index < children.length; index++) {
        const { node: child } = children[index];
        const { top, bottom, height } = child.getBoundingClientRect();
        if (child.getAttribute('aria-identifier') === elementId) continue;

        /** 2 * 5rem = 80px */
        const selectionSize = Math.min(height / 2, 80);

        const outOfBounds = mouseY < top || mouseY > bottom;
        const withinTop = mouseY <= top + selectionSize;
        const withinBottom = mouseY > bottom - selectionSize ? 1 : 0;

        if (outOfBounds) continue;
        else if (withinTop || withinBottom)
          elementManager.moveElementToGroup({
            elementId,
            fromGroupId,
            index: index + withinBottom,
            toGroupId,
          });
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
    if (!$element) throw new Error(`Couldn't find element: ${elementId}`);

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
