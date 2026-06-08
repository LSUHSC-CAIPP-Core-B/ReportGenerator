import { ReportGroup } from '../models/ReportGroup.js';
import { ReportBuilder } from '../ReportBuilder.js';
import { iterateGroups } from '../utils/groupTree.js';

export class PendingInsertManager {
  /** @type {string} */
  #pendingId = null;

  /** @type {HTMLElement | null} */
  #pendingElement = null;

  /** @type {number} */
  #insertionDelay = 0;

  /** @type {number} */
  #pendingInsertIndex = 0;

  /** @type {HTMLElement} */
  #insertMarker;

  /** @type {ReportBuilder} */
  #report;

  /**
   * @param {ReportBuilder} report
   */
  constructor(report) {
    this.#report = report;

    this.#insertMarker = document.createElement('div');
    this.#insertMarker.classList.add('insert-marker');
  }

  beginPendingElement(options) {
    this.#pendingElement = options;
    this.#pendingId = this.#report.getGroupManager().getGroupId(0);

    // let's delay by 15ms
    this.#insertionDelay = Date.now() + 15;
    this.#pendingInsertIndex = 0;

    this.#updateKeyboardInsertMarker();
    document.addEventListener('keydown', this.#handlePendingKeybinds);
    this.#report.toggleFrames(false);
  }

  cancelPendingElement() {
    this.#pendingElement = null;
    this.#pendingInsertIndex = null;
    this.#pendingId = null;
    this.removeInsertMarker();

    this.#clearGroupSelectionUI();

    document.removeEventListener('keydown', this.#handlePendingKeybinds);
    this.#report.toggleFrames(true);
  }

  #handlePendingKeybinds(event) {
    if (!this.#pendingElement) return;
    if (this.#insertionDelay > Date.now()) return;
    const elementManager = this.#report.getElementManager();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.#moveInsertPosition(1);
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.#moveInsertPosition(-1);
        break;

      case 'Enter':
        event.preventDefault();

        elementManager.insertElementIntoGroup(
          this.#pendingId,
          this.#pendingElement,
          this.#pendingInsertIndex,
          true,
        );

        this.cancelPendingElement();
        break;

      case 'Escape':
        event.preventDefault();
        this.cancelPendingElement();
        break;
    }
  }

  /**
   * @param {ReportGroup} group
   */
  attachGroupEvents(groupId) {
    const groupManager = this.#report.getGroupManager();
    const elementManager = this.#report.getElementManager();
    const { content, identifier } = groupManager.getGroup(groupId);

    content.addEventListener('mousemove', (event) => {
      if (!this.#pendingElement) return;

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

      this.#pendingId = identifier;
      this.#pendingInsertIndex = insertIndex;
      this.setInsertMarker(identifier, insertIndex);
    });

    content.addEventListener('click', () => {
      if (!this.#pendingElement) return;

      elementManager.insertElementIntoGroup(
        this.#pendingId,
        this.#pendingElement,
        this.#pendingInsertIndex,
      );

      this.cancelPendingElement();
    });
  }

  #moveInsertPosition(direction) {
    const groupManager = this.#report.getGroupManager();

    const groupId = this.#pendingId;
    let groupIndex = groupManager.getGroupIndex(groupId);
    const group = groupManager.getGroup(groupId);

    if (!group) return;

    const nextIndex = this.#pendingInsertIndex + direction;

    if (direction < 0) {
      // Up Arrow
      if (nextIndex < 0) {
        if (groupIndex <= 0) return;
        groupIndex--;

        const prevGroupId = groupManager.getGroupId(groupIndex);
        const prevGroup = groupManager.getGroup(prevGroupId);

        this.#pendingId = prevGroup.identifier;
        this.#pendingInsertIndex = prevGroup.elements.length;
      } else this.#pendingInsertIndex = nextIndex;
    } else {
      // Down Arrow
      if (nextIndex > group.elements.length) {
        if (groupIndex >= groupIds.length - 1) return;
        groupIndex++;

        const nextGroupId = groupManager.getGroupId(groupIndex);
        const nextGroup = groupManager.getGroup(nextGroupId);

        this.#pendingId = nextGroup.identifier;
        this.#pendingInsertIndex = 0;
      } else this.#pendingInsertIndex = nextIndex;
    }

    this.#updateKeyboardInsertMarker();
  }

  #updateKeyboardInsertMarker() {
    this.setInsertMarker(this.#pendingId, this.#pendingInsertIndex, true);
  }

  #clearGroupSelectionUI() {
    iterateGroups(this.#report.getGroupManager(), 0, ({ content }) => {
      content.classList.remove('pending-target');
    });
  }

  /**
   * Show the insert marker for a group
   * @param {string} groupId
   * @param {number} index
   * @param {boolean} scroll
   */
  setInsertMarker(groupId, index, scroll = false) {
    const groupManager = this.#report.getGroupManager();
    if (!groupManager.hasGroup(groupId)) return;
    const { content } = groupManager.getGroup(groupId);

    this.#pendingId = groupId;
    this.#pendingInsertIndex = index;

    const children = [...content.querySelectorAll('.b-element')];
    const beforeNode = children[index];

    if (beforeNode) content.insertBefore(this.#insertMarker, beforeNode);
    else content.appendChild(this.#insertMarker);

    const view_padding = 120;
    const rect = this.#insertMarker.getBoundingClientRect();
    const visible = rect.top >= view_padding && rect.bottom <= window.innerHeight - view_padding;

    if (!visible && scroll)
      this.#insertMarker.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  removeInsertMarker() {
    this.#insertMarker.parentNode?.removeChild(this.#insertMarker);
  }

  /**
   * @param {HTMLElement} element
   */
  isInsertMarker(element) {
    return this.#insertMarker === element;
  }
}
