import type { GroupManager } from '../managers/GroupManager.ts';
import type { ReportGroup } from '../models/ReportGroup.ts';

export function getDescendants(manager: GroupManager, groupId: string): ReportGroup[] {
  return getSubtree(manager, groupId).slice(1);
}

export function getSubtree(manager: GroupManager, groupId: string): ReportGroup[] {
  const startIndex = manager.getGroupIndex(groupId);
  if (startIndex === -1) return [];

  const parent = manager.getGroup(groupId);
  if (!parent) return [];

  const subtree = [parent];

  iterateGroups(manager, startIndex + 1, (group) => {
    if (!group) return;
    if (group.depth <= parent.depth) return false;
    subtree.push(group);
  });

  return subtree;
}

export function isDescendant(manager: GroupManager, parentId: string, childId: string): boolean {
  let current = manager.getGroup(childId);

  while (current?.parentId) {
    if (current.parentId === parentId) return true;
    current = manager.getGroup(current.parentId);
  }

  return false;
}

export function iterateGroups(
  manager: GroupManager,
  startIndex: number,
  callback: (group: ReportGroup, index: number) => boolean | undefined,
) {
  const size = manager.getGroupOrderSize();
  for (let index = startIndex; index < size; index++) {
    const identifier = manager.getGroupId(index);
    const group = manager.getGroup(identifier);

    const breakOut = callback(group, index) === false;
    if (breakOut) break;
  }
}
