import type { ElementManager } from '../managers/ElementManager.ts';

export class ElementRenderer {
  private manager: ElementManager;

  constructor(manager: ElementManager) {
    this.manager = manager;
  }

  toggleDragEffect(elementId: string, force: boolean | null = null) {
    const element = this.manager.getElement(elementId);
    if (!element) return;

    const { node } = element;
    if (force === null) force = !node.classList.contains('dragging');
    node.classList.toggle('dragging', force);
  }

  toggleInsertionOverlay(elementId: string, force: boolean | null = null) {
    const element = this.manager.getElement(elementId);
    if (!element) return;

    const { node } = element;
    if (force === null) force = !node.classList.contains('hovering');
    node.classList.toggle('hovering', force);
  }

  toggleOverlay(force: boolean) {
    this.manager.iterateElements(({ node: element }) => {
      element.classList.toggle('collapsed', force);
    });
  }

  // changeGhost(_event) {
  //   element.addEventListener('dragstart', (e) => {
  //     const ghost = element.cloneNode(true);

  //     // optional: style it smaller
  //     ghost.style.width = '100px';
  //     ghost.style.transform = 'scale(0.5)';
  //     ghost.style.position = 'absolute';
  //     ghost.style.top = '-9999px';

  //     document.body.appendChild(ghost);

  //     e.dataTransfer.setDragImage(ghost, 10, 10);

  //     setTimeout(() => document.body.removeChild(ghost), 0);
  //   });
  // }
}
