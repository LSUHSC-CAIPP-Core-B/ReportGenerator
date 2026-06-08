import { GroupManager } from '../managers/GroupManager.js';
import { ReportGroup } from '../models/ReportGroup.js';

/**
 * @param { GroupManager } manager
 * @param { string } groupId
 * @returns { ReportGroup[] }
 */
export function getDescendants(manager, groupId) {
  return getSubtree(manager, groupId).slice(1);
}

/**
 * @param { GroupManager } manager
 * @param { string } groupId
 * @returns { ReportGroup[] }
 */
export function getSubtree(manager, groupId) {
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

/**
 * @param { GroupManager } manager
 * @param { string } parentId
 * @param { string } childId
 * @returns { boolean }
 */
export function isDescendant(manager, parentId, childId) {
  let current = manager.getGroup(childId);

  while (current?.parentId) {
    if (current.parentId === parentId) return true;
    current = manager.getGroup(current.parentId);
  }

  return false;
}

/**
 *
 * @param { GroupManager } manager
 * @param { number } startIndex
 * @param { ( group: ReportGroup, index: number ) => (boolean | undefined) } callback
 */
export function iterateGroups(manager, startIndex, callback) {
  const size = manager.getGroupOrderSize();
  for (let index = startIndex; index < size; index++) {
    const identifier = manager.getGroupId(index);
    const group = manager.getGroup(identifier);

    const breakOut = callback(group, index) === false;
    if (breakOut) break;
  }
}
