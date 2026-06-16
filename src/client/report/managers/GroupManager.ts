import type { ProjectActionType } from '../../../shared/index.ts';
import { ReportGroup } from '../models/ReportGroup.ts';
import type { ReportBuilder } from '../ReportBuilder.ts';
import { GroupRenderer } from '../renderers/GroupRenderer.ts';
import { getDescendants, getSubtree } from '../utils/groupTree.ts';
import { createIdentifier } from '../utils/identifiers.ts';

export class GroupManager {
  private groups: Map<string, ReportGroup> = new Map();
  private groupOrder: string[] = [];

  private report: ReportBuilder;
  private renderer: GroupRenderer;

  constructor(report: ReportBuilder) {
    this.report = report;
    this.renderer = new GroupRenderer(this);
  }

  create({
    title,
    elements = [],
    groupId = createIdentifier(),
    parentId = null,
  }: ProjectActionType<'group:create', 'type' | 'groupId' | 'parentId'>) {
    const depth = parentId ? (this.groups.get(parentId)?.depth ?? 0) + 1 : 0;

    const layoutManager = this.report.getLayoutManager();
    const dragDropManager = this.report.getDragDropManager();
    const elementManager = this.report.getElementManager();
    const insertManager = this.report.getPendingInsertManager();

    const { entry: menuEntry, content } = layoutManager.create({
      depth,
      identifier: groupId,
      title,
    });

    if (parentId) layoutManager.getMenuEntry(parentId)?.classList.toggle('collapsable', true);

    const group = new ReportGroup({
      content,
      depth,
      identifier: groupId,
      menuEntry,
      parentId,
      title,
    });

    this.groups.set(groupId, group);
    this.groupOrder.push(groupId);

    for (const options of elements) elementManager.insertElementIntoGroup({ groupId, options });

    dragDropManager.attachGroupEvents(groupId);
    insertManager.attachGroupEvents(groupId);

    this.report.emit('group:create', {
      groupId: groupId,
      parentId,
      title,
    });

    return group;
  }

  /**
   * @param {string} groupId
   * @param {string} targetId
   * @param {'before'|'after'|'inside'} position
   */
  moveGroup({
    groupId,
    targetId,
    position = 'after',
  }: ProjectActionType<'group:move', 'position' | 'type'>) {
    if (groupId === targetId) return;

    const movingSubtree = this.getSubtree(groupId);
    if (!movingSubtree.length) return;

    const movingIds = movingSubtree.map(({ identifier }) => identifier);
    // Prevent dropping into own subtree
    if (movingIds.includes(targetId)) return;

    const target = this.groups.get(targetId);
    const root = this.groups.get(groupId);
    if (!root || !target) return;

    this.groupOrder = this.groupOrder.filter((identifier) => !movingIds.includes(identifier));

    if (position === 'inside') root.parentId = target.identifier;
    else root.parentId = target.parentId;

    this.updateSubtreeDepths(groupId);

    let insertIndex = this.groupOrder.indexOf(targetId);

    if (position !== 'before') {
      insertIndex++;

      while (insertIndex < this.groupOrder.length) {
        const current = this.groups.get(this.groupOrder[insertIndex]);
        if (!current) break;
        if (current.depth <= target.depth) break;
        insertIndex++;
      }
    }

    this.groupOrder.splice(insertIndex, 0, ...movingIds);
    this.rebuildGroupDOM();

    this.report.emit('group:move', {
      groupId,
      position,
      targetId,
    });
  }

  deleteGroup({ groupId }: ProjectActionType<'group:delete', 'type'>) {
    const group = this.groups.get(groupId);
    if (!group) return;

    this.groups.delete(groupId);
    this.groupOrder = this.groupOrder.filter((id) => id !== groupId);

    group.content.remove();
    group.menuEntry.remove();

    this.report.emit('group:delete', {
      groupId,
    });
  }

  getDescendants(groupId: string) {
    return getDescendants(this, groupId);
  }

  getSubtree(groupId: string) {
    return getSubtree(this, groupId);
  }

  private updateSubtreeDepths(rootId: string) {
    const root = this.groups.get(rootId);
    if (!root) return;

    const subtree = this.getSubtree(rootId);

    const rootDepth = root.parentId ? (this.groups.get(root.parentId)?.depth ?? -1) + 1 : 0;

    const originalDepth = root.depth;
    const delta = rootDepth - originalDepth;

    for (const group of subtree) {
      group.depth += delta;

      group.menuEntry.style.setProperty('--menu-indent', group.depth.toString());
      group.menuEntry.classList.toggle('indent', group.depth > 0);
    }
  }

  private rebuildGroupDOM() {
    const GROUPS = [...this.groups.values()].sort(
      (a, b) => b.parentId?.localeCompare(a.identifier) ?? 0,
    );

    GROUPS.forEach((group, _index, arr) => {
      const parent = arr.find((parent) => parent.identifier === group.parentId);
      group.depth = (parent?.depth ?? -1) + 1;
    });

    const layoutManager = this.report.getLayoutManager();
    layoutManager.organize(this.groupOrder);

    for (const identifier of this.groupOrder) {
      const group = this.groups.get(identifier);
      if (!group) continue;

      const hasChildren = GROUPS.some((g) => g.parentId === identifier);
      const { depth, menuEntry: entry } = group;

      entry.classList.toggle('collapsable', hasChildren);
      entry.classList.toggle('indent', depth > 0);

      if (depth) entry.style.setProperty('--menu-indent', depth.toString());
      else entry.style.removeProperty('--menu-indent');
    }
  }

  /**
   * Get group's index in group order
   * @param {string} groupId
   * @returns {number}
   */
  getGroupIndex(groupId: string): number {
    return this.groupOrder?.indexOf(groupId) ?? -1;
  }

  /**
   * Get group from identifier
   */
  getGroup(groupId: string): ReportGroup | undefined {
    return this.groups?.get(groupId);
  }

  /**
   * Check if group exists from identifier
   */
  hasGroup(groupId: string): boolean {
    return this.groups?.has(groupId);
  }

  /**
   * Get group identifier from index.
   * A negative index will count back from the last item.
   */
  getGroupId(index: number): string | undefined {
    return this.groupOrder?.at(index);
  }

  /**
   * Get size of group order
   */
  getGroupOrderSize(): number {
    return this.groupOrder?.length ?? 0;
  }

  getRenderer() {
    return this.renderer;
  }
}
