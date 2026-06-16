import type { ProjectGroup } from './models.ts';

export function computeDepth(groups: ProjectGroup[]) {
  const map = new Map(groups.map((g) => [g.identifier, g]));

  return (group: ProjectGroup) => {
    let depth = 0;
    let current = group;

    while (current.parentId) {
      const parent = map.get(current.parentId);
      if (!parent) break;
      depth++;
      current = parent;
    }

    return depth;
  };
}

export function getSubtree(groups: ProjectGroup[], startIndex: number) {
  const root = groups[startIndex];
  if (!root) return [];

  const result = [root];
  const baseDepth = root.depth ?? 0;

  for (let i = startIndex + 1; i < groups.length; i++) {
    const g = groups[i];
    if ((g.depth ?? 0) <= baseDepth) break;
    result.push(g);
  }

  return result;
}

export function isDescendant(groups: ProjectGroup[], parentId: string, childId: string) {
  const map = new Map(groups.map((g) => [g.identifier, g]));

  let current = map.get(childId);
  while (current?.parentId) {
    if (current.parentId === parentId) return true;
    current = map.get(current.parentId);
  }

  return false;
}
