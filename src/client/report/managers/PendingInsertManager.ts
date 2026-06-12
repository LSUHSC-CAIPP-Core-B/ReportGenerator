import type { ElementOptions } from '../../../shared/types.ts';
import type { ReportBuilder } from '../ReportBuilder.ts';
import { iterateGroups } from '../utils/groupTree.ts';

export class PendingInsertManager {
  private pendingId: string | null = null;
  private pendingElement: ElementOptions | null = null;
  private insertionDelay: number = 0;
  private pendingInsertIndex: number = 0;
  private insertMarker: HTMLElement;
  private report: ReportBuilder;

  constructor(report: ReportBuilder) {
    this.report = report;

    this.insertMarker = document.createElement('div');
    this.insertMarker.classList.add('insert-marker');
  }

  beginPendingElement(options) {
    this.pendingElement = options;
    this.pendingId = this.report.getGroupManager().getGroupId(0) ?? null;

    // let's delay by 15ms
    this.insertionDelay = Date.now() + 15;
    this.pendingInsertIndex = 0;

    this.updateKeyboardInsertMarker();
    document.addEventListener('keydown', this.handlePendingKeybinds);
    this.report.toggleFrames(false);
  }

  cancelPendingElement() {
    this.pendingElement = null;
    this.pendingInsertIndex = -1;
    this.pendingId = null;
    this.removeInsertMarker();

    this.clearGroupSelectionUI();

    document.removeEventListener('keydown', this.handlePendingKeybinds);
    this.report.toggleFrames(true);
  }

  private handlePendingKeybinds(event: KeyboardEvent) {
    if (!this.pendingElement) return;
    if (this.insertionDelay > Date.now()) return;
    const elementManager = this.report.getElementManager();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveInsertPosition(1);
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.moveInsertPosition(-1);
        break;

      case 'Enter':
        event.preventDefault();

        if (!this.pendingId) break;

        elementManager.insertElementIntoGroup(
          this.pendingId,
          this.pendingElement,
          this.pendingInsertIndex,
        );

        this.cancelPendingElement();
        break;

      case 'Escape':
        event.preventDefault();
        this.cancelPendingElement();
        break;
    }
  }

  attachGroupEvents(groupId: string) {
    const groupManager = this.report.getGroupManager();
    const elementManager = this.report.getElementManager();
    const $group = groupManager.getGroup(groupId);
    if (!$group) return;

    const { content, identifier } = $group;

    content.addEventListener('mousemove', (event) => {
      if (!this.pendingElement) return;

      const children = [...content.children].filter((child) =>
        child.classList.contains('b-element'),
      );
      let insertIndex = children.length;

      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const rect = child.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;

        if (event.clientY < midpoint) {
          insertIndex = i;
          break;
        }
      }

      this.pendingId = identifier;
      this.pendingInsertIndex = insertIndex;
      this.setInsertMarker(identifier, insertIndex);
    });

    content.addEventListener('click', () => {
      if (!this.pendingId) return;
      if (!this.pendingElement) return;

      elementManager.insertElementIntoGroup(
        this.pendingId,
        this.pendingElement,
        this.pendingInsertIndex,
      );

      this.cancelPendingElement();
    });
  }

  private moveInsertPosition(direction: number) {
    const groupManager = this.report.getGroupManager();

    const groupId = this.pendingId;
    if (!groupId) return;

    let groupIndex = groupManager.getGroupIndex(groupId);
    const group = groupManager.getGroup(groupId);

    if (!group) return;

    const nextIndex = this.pendingInsertIndex + direction;

    if (direction < 0) {
      // Up Arrow
      if (nextIndex < 0) {
        if (groupIndex <= 0) return;
        groupIndex--;

        const prevGroupId = groupManager.getGroupId(groupIndex);
        if (!prevGroupId) return;

        const prevGroup = groupManager.getGroup(prevGroupId);
        if (!prevGroup) return;

        this.pendingId = prevGroup.identifier;
        this.pendingInsertIndex = prevGroup.elements.length;
      } else this.pendingInsertIndex = nextIndex;
    } else {
      // Down Arrow
      if (nextIndex > group.elements.length) {
        if (groupIndex >= group.elements.length - 1) return;
        groupIndex++;

        const nextGroupId = groupManager.getGroupId(groupIndex);
        if (!nextGroupId) return;
        const nextGroup = groupManager.getGroup(nextGroupId);
        if (!nextGroup) return;

        this.pendingId = nextGroup.identifier;
        this.pendingInsertIndex = 0;
      } else this.pendingInsertIndex = nextIndex;
    }

    this.updateKeyboardInsertMarker();
  }

  private updateKeyboardInsertMarker() {
    if (!this.pendingId) return;
    this.setInsertMarker(this.pendingId, this.pendingInsertIndex, true);
  }

  private clearGroupSelectionUI() {
    iterateGroups(this.report.getGroupManager(), 0, ({ content }) => {
      content.classList.remove('pending-target');
    });
  }

  setInsertMarker(groupId: string, index: number, scroll: boolean = false) {
    const groupManager = this.report.getGroupManager();
    if (!groupManager.hasGroup(groupId)) return;
    const $group = groupManager.getGroup(groupId);
    if (!$group) return;
    const { content } = $group;

    this.pendingId = groupId;
    this.pendingInsertIndex = index;

    const children = [...content.querySelectorAll('.b-element')];
    const beforeNode = children[index];

    if (beforeNode) content.insertBefore(this.insertMarker, beforeNode);
    else content.appendChild(this.insertMarker);

    const view_padding = 120;
    const rect = this.insertMarker.getBoundingClientRect();
    const visible =
      rect.top >= view_padding && rect.bottom <= globalThis.innerHeight - view_padding;

    if (!visible && scroll)
      this.insertMarker.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  removeInsertMarker() {
    this.insertMarker.parentNode?.removeChild(this.insertMarker);
  }

  isInsertMarker(element: HTMLElement) {
    return this.insertMarker === element;
  }
}
