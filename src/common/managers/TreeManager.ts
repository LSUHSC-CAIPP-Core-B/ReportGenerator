export interface TreeManager<T extends TreeElement> {
  setParent(child: T, parent?: T): void;
  getParent(child: T): T | undefined;
  getChildren(parent: T): T[];

  getById(id: T['identifier']): T | undefined;
  resolveHighestParent(child: T): T | undefined;
  resolveNextSibling(child: T): T | undefined;
  resolveLastInHierarchy(parent: T): T | undefined;
}

export type TreeElement = {
  identifier: string;
  parentId?: string | null;
};
