import { type ReorderManager, ReorderManagerDefaults } from 'common/managers/ReorderManager.ts';
import type { TreeManager } from 'common/managers/TreeManager.ts';
import {
  type ProjectAction,
  type ProjectActionType,
  type ProjectDef,
  type ProjectElement,
  type ProjectElementDef,
  ProjectError,
  type ProjectGroup,
  type ProjectGroupDef,
  type ProjectInfo,
  type ProjectReport,
} from 'common/types/projects.ts';
import { catchErrorTyped, createIdentifier, stripFunctions } from 'common/utilities.ts';
import { Config, DataError, JsonDB } from 'node-json-db';

const config = new Config('projects.db', true, true, '/');

interface ProjectManager2 {
  readonly report: ProjectReport;
  readonly groups: GroupManager;
  readonly elements: ProjectElementManager;

  delete(): void;
  patch(data: Partial<ProjectReport>): ProjectManager2;
  replace(self: ProjectReport): ProjectManager2;

  apply(action: ProjectAction): ProjectManager2;
}

interface ProjectElementManager {
  readonly groups: GroupManager;

  create(action: ProjectActionType<'element:create'>): void;
  move(action: ProjectActionType<'element:move'>): void;
  delete(action: ProjectActionType<'element:delete'>): void;
  update(action: ProjectActionType<'element:update'>): void;
}

interface GroupManager extends TreeManager<ProjectGroup>, ReorderManager<ProjectGroup> {
  readonly report: ProjectReport;
  readonly project: ProjectManager2;
  readonly elements: ProjectElementManager;

  popById(groupId: string): ProjectGroup | undefined;
  getElements(groupId: string): ElementManager | undefined;

  create(group: ProjectGroupDef): void;
  move(action: ProjectActionType<'group:move'>): void;
  delete(action: ProjectActionType<'group:delete'>): void;
}

interface ElementManager extends ReorderManager<ProjectElement> {
  create(element: ProjectElementDef, index?: number): ProjectElementDef;
  delete(elementId: string): ProjectElement | undefined;
  update(elementId: string, data: Record<string, any>): unknown;

  readonly report: ProjectReport;
  readonly project: ProjectManager2;
  readonly group: ProjectGroup;
}

class ProjectDatabase {
  private readonly database: JsonDB;

  constructor() {
    this.database = new JsonDB(config);
  }

  async getProject(projectId: string): Promise<ProjectManager2 | undefined> {
    if (typeof projectId !== 'string') {
      throw new ProjectError('Project id is not a string');
    }
    if (!projectId?.trim()) {
      throw new ProjectError('Project id is required');
    }

    const path = projectId?.toLowerCase();

    const [error, report] = await catchErrorTyped(
      this.database.getObject<ProjectReport>(`/${path}`),
      [DataError],
    );

    if (error) return undefined;
    await this.database.push(`/${path}/last_opened`, new Date().toISOString(), true);
    return getProjectManager(report, this.database);
  }

  async getAllProjects() {
    const [, data] = await catchErrorTyped(this.database.getData('/'), [DataError]);

    const projects: ProjectInfo[] = Object.entries(data)
      .map(([path, project]) => [path, project as ProjectReport] as const)
      .filter(([, project]) => typeof project === 'object')
      .map(([path, { title, last_opened }]) => ({ last_opened, path, title }) as ProjectInfo);

    return projects ?? [];
  }

  async createProject({
    project,
    title = project,
    path = project?.toLowerCase(),
  }: ProjectDef): Promise<ProjectManager2> {
    if (typeof project !== 'string') {
      throw new ProjectError('Project id is not a string');
    }

    if (!project?.trim()) {
      throw new ProjectError('Project id is required');
    }

    const exists = await this.database.exists(`/${path}`);
    if (exists) throw new ProjectError(`Project path already exists: ${path}`);

    const report = {
      identifier: path,
      last_opened: new Date().toISOString(),
      project,
      title,
    } satisfies ProjectReport;

    await this.database.push(`/${path}`, report, true);
    return Object.assign(report, getProjectManager(report, this.database));
  }
}

const handler = new ProjectDatabase();
export default handler;

function recomputeDepth(groups: ProjectGroup[]) {
  const map = new Map(groups.map((g) => [g.identifier, g]));

  const getDepth = (group: ProjectGroup) => {
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

  for (const g of groups) {
    g.depth = getDepth(g);
  }
}

function getProjectManager(report: ProjectReport, database: JsonDB): ProjectManager2 {
  const MANAGER: Pick<ProjectManager2, 'report' | 'groups'> = { report } as ProjectManager2;
  Object.assign(MANAGER, { groups: getGroupManager(MANAGER as ProjectManager2, report) });

  return Object.assign(MANAGER, {
    apply(this: ProjectManager2, action) {
      switch (action.type) {
        case 'group:create':
          this.groups.create(action.options);
          break;

        case 'group:move':
          this.groups.move(action);
          break;

        case 'group:delete':
          this.groups.delete(action);
          break;

        case 'element:create':
          this.elements.create(action);
          break;

        case 'element:move':
          this.elements.move(action);
          break;

        case 'element:delete':
          this.elements.delete(action);
          break;

        case 'element:update':
          this.elements.update(action);
          break;

        default:
          throw new Error(`Invalid action type: ${action satisfies never}`);
      }

      return this as ProjectManager2;
    },

    delete: () => database.delete(`/${report.identifier}`),

    elements: getProjectElementManager(MANAGER.groups),

    patch(data: Partial<ProjectReport>) {
      Object.assign(report, stripFunctions(data));
      return this as ProjectManager2;
    },

    // Remove existing functions (or other ProjectManager functions)
    replace(self: ProjectReport) {
      Object.assign(report, stripFunctions(self));
      return this as ProjectManager2;
    },
  } satisfies Omit<ProjectManager2, 'report' | 'groups'>);
}

function getProjectElementManager(groups: GroupManager): ProjectElementManager {
  const MANAGER: Pick<ProjectElementManager, 'groups'> = { groups };

  return Object.assign(MANAGER, {
    create(this: ProjectElementManager, action) {
      this.groups.getElements(action.groupId)?.create(action.options, action.index);
    },

    delete(this: ProjectElementManager, action) {
      this.groups.getElements(action.groupId)?.delete(action.elementId);
    },

    move(this: ProjectElementManager, action) {
      const manager = this.groups.getElements(action.fromGroupId);
      const element = manager?.delete(action.elementId);
      if (element) manager?.put(element, action.index);
    },

    update(this: ProjectElementManager, action) {
      const parent = this.groups.getAll().find(({ elements }) => {
        return elements.some(({ id }) => id === action.elementId);
      });

      if (!parent) return;

      this.groups.getElements(parent.id)?.update(action.elementId, action.data);
    },
  } satisfies Omit<ProjectElementManager, 'groups'>);
}

function getGroupManager(project: ProjectManager2, report: ProjectReport): GroupManager {
  const MANAGER: Pick<GroupManager, 'project' | 'report'> = { project, report };

  return Object.assign(
    MANAGER,
    {
      create(this: GroupManager, action) {
        const groupDef: ProjectGroupDef = Object.fromEntries(
          Object.entries(action).filter(([key]) => {
            return !['type', 'elements'].includes(key);
          }),
        ) as ProjectGroupDef;

        const group = Object.assign(groupDef, { elements: [], id: createIdentifier() });

        this.put(group);

        if (action.elements) {
          const elementManager = this.getElements(group.id)!;

          for (const element of action.elements) {
            elementManager.create(element);
          }
        }
      },

      delete(action) {
        // Recusively remove sub-groups
        this.getAll()
          .filter(({ parentId }) => parentId === action.groupId)
          .map(
            ({ id: groupId }) =>
              ({ groupId, type: 'group:delete' }) satisfies ProjectActionType<'group:delete'>,
          )
          .forEach(this.delete);

        this.popById(action.groupId);
      },

      elements: getProjectElementManager(MANAGER as GroupManager),

      getById(id) {
        return this.getAll().find(({ id: self }) => self === id);
      },

      getChildren(this: GroupManager, parent) {
        return this.getAll().filter(({ parentId }) => parent.id === parentId);
      },

      getCollection(this: GroupManager) {
        this.report.groups ??= [];
        return this.report.groups;
      },

      getElements(this: GroupManager, groupId: string) {
        return getElementManager(this.project, this.report, groupId);
      },

      getParent(this: GroupManager, child) {
        return this.getAll().find(({ id }) => id === child.parentId);
      },

      move(action) {
        const collection = this.getCollection();

        const group = this.getById(action.groupId);
        const target = this.getById(action.targetId);

        if (!group || !target) return;

        const index = collection.indexOf(target);

        switch (action.position) {
          case 'inside': {
            this.put(group, index + 1);

            // Make sure the parent is set to the target
            group.parentId = target.id;
            break;
          }

          case 'before': {
            // The parent will be set automatically
            // should be the parent of the target if
            // target has a parent.
            this.put(group, index);
            break;
          }

          case 'after': {
            const lastInHierarchy = this.resolveLastInHierarchy(target);
            const lastChildIndex = lastInHierarchy ? collection.indexOf(lastInHierarchy) : -1;

            const insertIndex = lastChildIndex + lastChildIndex / Math.abs(lastChildIndex || 1);
            this.put(group, insertIndex >= 0 ? insertIndex : undefined);

            // Make sure the parents are the same
            group.parentId = target.parentId;
            break;
          }

          default:
            throw new Error(`Invalid position: ${action.position satisfies never}`);
        }
      },

      popById(this: GroupManager, groupId: string) {
        const collection = this.getCollection();
        const index = collection.findIndex(({ id }) => id === groupId);
        return collection.splice(index, 1)[0];
      },

      resolveHighestParent(this: GroupManager, child) {
        let target: ProjectGroup = child;
        const groups = this.getAll();

        while (target.parentId != null) target = groups.find(({ id }) => id === target.parentId)!;
        return target !== child ? target : undefined;
      },

      resolveLastInHierarchy(this: GroupManager, parent) {
        let child = parent;

        while (true) {
          const next = this.getChildren(child).at(-1);
          if (!next) return parent !== child ? child : undefined;
          child = next;
        }
      },

      resolveNextSibling(this: GroupManager, child) {
        const groups = this.getAll();
        const afterIndex = groups.indexOf(child);
        return groups.find(
          ({ parentId }, index) => index > afterIndex && parentId === child.parentId,
        );
      },

      setParent(this: GroupManager, child, parent) {
        const groups = this.getAll();
        const hasChild = groups.includes(child);
        const hasParent = parent && groups.includes(parent);

        // No need to assign anything.
        // Either the child isn't in the array,
        // Or the parent isn't in the array and exists.
        if (!hasChild || !(hasParent || !parent)) return;

        if (hasParent) {
          const insertIndex = groups.indexOf(parent);
          this.put(child, insertIndex + 1);

          // GroupManager.put() might have given a different
          // parent, let's ensure the parent is correct
          child.parentId = parent?.id;
        } else if (!parent && child.parentId) {
          // The child might already be an orphan
          const highestParent = this.resolveHighestParent(child);

          if (highestParent) {
            // The child has a parent, remove it
            const lastInHierarchy = this.resolveLastInHierarchy(highestParent);
            const lastChildIndex = lastInHierarchy ? groups.indexOf(lastInHierarchy) : -1;

            const insertIndex = lastChildIndex + lastChildIndex / Math.abs(lastChildIndex || 1);
            this.put(child, insertIndex >= 0 ? insertIndex : undefined);

            // GroupManager.put() didn't give a parent,
            // but let's make sure.
            child.parentId = undefined;
          }
        }
      },

      ...ReorderManagerDefaults(),
    } satisfies Omit<GroupManager, 'project' | 'report'>,
    {
      put(this: GroupManager, element: ProjectGroup, index?: number) {
        const collection = this.getCollection();

        const length = collection.length ?? 0;
        const includes = collection.includes(element);

        // Use length if index is not provided,
        // also keep within length of collection
        let target = (((index ?? length) % length) + length) % length;
        // We will get NaN if length is 0
        if (length === 0) target = 0;

        if (includes) {
          const selfIndex = collection.indexOf(element);

          if (selfIndex === target) return;
          else if (selfIndex < target) target--;
          collection.splice(selfIndex, 1);
        }

        if (target !== collection.length) {
          collection.splice(target, 0, element);

          // We know if the child after has a parent,
          // then this element needs to have a parent.
          element.parentId = collection.at(target + 1)?.parentId;
        } else collection.push(element);
      },
    } satisfies Pick<GroupManager, 'put'>,
  );
}

function getElementManager(
  project: ProjectManager2,
  report: ProjectReport,
  groupId: string,
): ElementManager | undefined {
  const group = report.groups?.find(({ id }) => id === groupId);
  if (!group) return;

  const MANAGER: Pick<ElementManager, 'project' | 'report' | 'group'> = { group, project, report };

  return Object.assign(MANAGER, {
    create(partial, index) {
      const element: ProjectElement = Object.assign(
        { id: createIdentifier() },
        partial,
      ) as ProjectElement;

      this.put(element, index);
      return element;
    },

    delete(this: ElementManager, elementId) {
      const collection = this.getCollection();
      const index = collection.findIndex(({ id }) => id === elementId);
      return index >= 0 ? collection.splice(index, 1)[0] : undefined;
    },

    getCollection(this: ElementManager) {
      this.group.elements ??= [];
      return this.group.elements;
    },

    update(elementId, data) {
      const collection = this.getCollection();
      const element = collection.find(({ id }) => id === elementId);
      return element ? Object.assign(element, data) : undefined;
    },

    ...ReorderManagerDefaults(),
  } satisfies Omit<ElementManager, 'project' | 'report' | 'group'>);
}
