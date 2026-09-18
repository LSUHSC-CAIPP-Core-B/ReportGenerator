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
} from 'common/project/types.ts';
import { catchErrorTyped, createIdentifier, stripFunctions } from 'common/utilities.ts';
import { Config, DataError, JsonDB } from 'node-json-db';

const config = new Config('projects.db', true, true, '/');

interface ProjectManager {
  readonly database: JsonDB;
  readonly report: ProjectReport;
  readonly groups: GroupManager;
  readonly elements: ProjectElementManager;

  delete(): void;
  patch(data: Partial<ProjectReport>): ProjectManager;
  replace(self: ProjectReport): ProjectManager;

  /**
   * Converts this project into a template.
   *
   * Hashed values are removed because templates are not allowed
   * to contain project-specific hashed data.
   */
  makeTemplate(): ProjectManager;

  apply(action: ProjectAction): ProjectManager;
}

interface ProjectElementManager {
  readonly groups: GroupManager;

  create(action: ProjectActionType<'element:create'>): void;
  move(action: ProjectActionType<'element:move'>): void;
  delete(action: ProjectActionType<'element:delete'>): void;
  update(action: ProjectActionType<'element:update'>): void;
}

interface GroupManager extends TreeManager<ProjectGroup>, ReorderManager<ProjectGroup> {
  readonly database: JsonDB;
  readonly report: ProjectReport;
  readonly project: ProjectManager;
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

  readonly database: JsonDB;
  readonly report: ProjectReport;
  readonly project: ProjectManager;
  readonly group: ProjectGroup;
}

class ProjectDatabase {
  private readonly database: JsonDB;

  constructor() {
    this.database = new JsonDB(config);
  }

  async getProject(path: string): Promise<ProjectManager | undefined> {
    if (typeof path !== 'string') {
      throw new ProjectError('Path is not a string');
    } else if (!path?.trim()) {
      throw new ProjectError('Path is required');
    }

    const [error, report] = await catchErrorTyped(
      this.database.getObject<ProjectReport>(`/${path.toLowerCase()}`),
      [DataError],
    );

    if (error) return undefined;

    Object.assign(report, { path });

    await this.database.push(`/${path}/last_opened`, new Date().toISOString(), true);

    return getProjectManager(report, this.database);
  }

  async getAllProjects() {
    const [, data] = await catchErrorTyped(this.database.getData('/'), [DataError]);

    const projects: ProjectInfo[] = Object.entries(data)
      .map(([path, project]) => [path, project as ProjectReport] as const)
      .filter(([, project]) => typeof project === 'object')
      .map(
        ([path, { title, last_opened }]) =>
          ({
            last_opened,
            path,
            title,
          }) as ProjectInfo,
      );

    return projects ?? [];
  }

  /**
   * Creates a new, empty project.
   *
   * Set `template: true` to create a template directly.
   */
  async createProject({
    project,
    title = project,
    path = project?.toLowerCase(),
    template = false,
  }: ProjectDef): Promise<ProjectInfo> {
    if (!title || typeof title !== 'string') {
      throw new ProjectError('Project title is required');
    }

    if (!path || typeof path !== 'string') {
      throw new ProjectError('Project path is required');
    }

    const exists = await this.database.exists(`/${path}`);

    if (exists) {
      throw new ProjectError(`Project path already exists: ${path}`);
    }

    const report: ProjectReport = {
      last_opened: new Date().toISOString(),
      path,
      project,
      template,
      title,
    };

    /*
     * Templates are never allowed to contain hashed values.
     *
     * This is mostly relevant when createProject() is eventually
     * extended to accept project contents.
     */
    if (template) {
      stripHashedValues(report);
    }

    await this.database.push(`/${path}`, report, true);

    return {
      last_opened: report.last_opened,
      path,
      title,
    };
  }

  /**
   * Creates a normal project from an existing template.
   *
   * The template is copied and receives completely new group and
   * element identifiers, so the new project is independent of the
   * original template.
   */
  async createProjectFromTemplate({
    templatePath,
    project,
    title = project,
    path = project?.toLowerCase(),
  }: {
    templatePath: string;
    project: string;
    title?: string;
    path?: string;
  }): Promise<ProjectInfo> {
    if (!templatePath || typeof templatePath !== 'string') {
      throw new ProjectError('Template path is required');
    } else if (!project || typeof project !== 'string') {
      throw new ProjectError('Project identifier is required');
    } else if (!title || typeof title !== 'string') {
      throw new ProjectError('Project title is required');
    } else if (!path || typeof path !== 'string') {
      throw new ProjectError('Project path is required');
    }

    const template = await this.getProject(templatePath);

    if (!template) {
      throw new ProjectError(`Template not found: ${templatePath}`);
    } else if (!template.report.template) {
      throw new ProjectError(`Project is not a template: ${templatePath}`);
    }

    const exists = await this.database.exists(`/${path}`);

    if (exists) {
      throw new ProjectError(`Project path already exists: ${path}`);
    }

    /*
     * Clone the template.
     *
     * structuredClone() is important here because modifying the new
     * project must never mutate the template's in-memory report.
     */
    const report = structuredClone(template.report);

    report.path = path;
    report.project = project;
    report.title = title;
    report.last_opened = new Date().toISOString();

    /*
     * The result of applying a template is always a normal project.
     */
    report.template = false;

    /*
     * A template should never contain hashed values, but strip them
     * here as an additional safety measure in case an older/corrupt
     * template does.
     */
    stripHashedValues(report);

    /*
     * The project must not share identifiers with the template.
     */
    regenerateIdentifiers(report);

    await this.database.push(`/${path}`, report, true);

    return {
      last_opened: report.last_opened,
      path,
      title,
    };
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

/**
 * Recursively removes every `hashed` property from an object.
 *
 * This deliberately walks the entire project rather than only
 * ProjectElement objects so nested hashed values cannot accidentally
 * make it into a template.
 */
function stripHashedValues(value: unknown): void {
  if (!value || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    for (const item of value) {
      stripHashedValues(item);
    }

    return;
  }

  const object = value as Record<string, unknown>;
  delete object.hashed;

  for (const child of Object.values(object)) {
    stripHashedValues(child);
  }
}

/**
 * Generates new identifiers for every group and element in a project.
 *
 * Parent IDs are updated to point to the newly-created group IDs.
 */
function regenerateIdentifiers(report: ProjectReport): void {
  const groups = report.groups ?? [];
  const groupIdMap = new Map<string, string>();

  /*
   * Generate all new group IDs first so parent references can be
   * resolved in a second pass.
   */
  for (const group of groups) {
    const oldId = group.identifier;
    const newId = createIdentifier();

    groupIdMap.set(oldId, newId);
    group.identifier = newId;
  }

  /*
   * Update parent references to the new group identifiers.
   */
  for (const group of groups) {
    if (group.parentId) {
      group.parentId = groupIdMap.get(group.parentId);
    }
  }

  /*
   * Generate completely new element identifiers.
   */
  for (const group of groups) {
    for (const element of group.elements ?? []) {
      element.identifier = createIdentifier();
    }
  }

  /*
   * Depth is derived from the hierarchy, so recalculate it after
   * changing the group relationships.
   */
  recomputeDepth(groups);
}

function getProjectManager(report: ProjectReport, database: JsonDB): ProjectManager {
  const MANAGER: Pick<ProjectManager, 'report' | 'groups' | 'database'> = {
    database,
    report,
  } as ProjectManager;

  Object.assign(MANAGER, {
    groups: getGroupManager(MANAGER as ProjectManager, report),
  });

  return Object.assign(MANAGER, {
    apply(this: ProjectManager, action) {
      switch (action.type) {
        case 'project:template':
          this.makeTemplate();
          break;

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

      /*
       * If a project is a template, make sure an action cannot
       * introduce hashed values into it.
       */
      if (this.report.template) {
        stripHashedValues(this.report);
      }

      return this as ProjectManager;
    },

    delete: () => database.delete(`/${report.project}`),

    elements: getProjectElementManager(MANAGER.groups),

    /**
     * Converts the current project into a template.
     *
     * Hashed values are removed immediately.
     */
    makeTemplate(this: ProjectManager) {
      stripHashedValues(this.report);

      this.report.template = true;

      /*
       * Persist the change immediately.
       */
      void this.database.push(`/${this.report.path}`, stripFunctions(this.report), true);

      return this;
    },

    patch(data: Partial<ProjectReport>) {
      /*
       * A caller cannot use patch() to bypass the template rules.
       */
      Object.assign(report, stripFunctions(data));

      if (report.template) {
        stripHashedValues(report);
      }

      return this as ProjectManager;
    },

    /*
     * Remove existing functions (or other ProjectManager functions).
     */
    replace(self: ProjectReport) {
      Object.assign(report, stripFunctions(self));

      if (report.template) {
        stripHashedValues(report);
      }

      return this as ProjectManager;
    },
  } satisfies Omit<ProjectManager, 'report' | 'groups' | 'database'>);
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

      if (element) {
        manager?.put(element, action.index);
      }
    },

    update(this: ProjectElementManager, action) {
      const parent = this.groups.getAll().find(({ elements }) => {
        return elements.some(({ identifier }) => identifier === action.elementId);
      });

      if (!parent) return;

      this.groups.getElements(parent.identifier)?.update(action.elementId, action.data);
    },
  } satisfies Omit<ProjectElementManager, 'groups'>);
}

function getGroupManager(project: ProjectManager, report: ProjectReport): GroupManager {
  const MANAGER: Pick<GroupManager, 'project' | 'report' | 'database'> = {
    database: project.database,
    project,
    report,
  };

  return Object.assign(
    MANAGER,
    {
      create(this: GroupManager, action) {
        const groupDef: ProjectGroupDef = Object.fromEntries(
          Object.entries(action).filter(([key]) => {
            return !['type', 'elements'].includes(key);
          }),
        ) as ProjectGroupDef;

        const group = Object.assign(groupDef, {
          elements: [],
          identifier: createIdentifier(),
        });

        this.put(group);

        if (action.elements) {
          const elementManager = this.getElements(group.identifier)!;

          for (const element of action.elements) {
            elementManager.create(element);
          }
        }
      },

      delete(action) {
        // Recursively remove sub-groups
        this.getAll()
          .filter(({ parentId }) => parentId === action.groupId)
          .map(
            ({ identifier: groupId }) =>
              ({
                groupId,
                type: 'group:delete',
              }) satisfies ProjectActionType<'group:delete'>,
          )
          .forEach(this.delete);

        this.popById(action.groupId);
      },

      elements: getProjectElementManager(MANAGER as GroupManager),

      getById(id) {
        return this.getAll().find(({ identifier: self }) => self === id);
      },

      getChildren(this: GroupManager, parent) {
        return this.getAll().filter(({ parentId }) => parent.identifier === parentId);
      },

      getCollection(this: GroupManager) {
        this.report.groups ??= [];

        return this.report.groups;
      },

      getElements(this: GroupManager, groupId: string) {
        return getElementManager(this.project, this.report, groupId);
      },

      getParent(this: GroupManager, child) {
        return this.getAll().find(({ identifier }) => identifier === child.parentId);
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
            group.parentId = target.identifier;
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

        const index = collection.findIndex(({ identifier }) => identifier === groupId);

        return index >= 0 ? collection.splice(index, 1)[0] : undefined;
      },

      resolveHighestParent(this: GroupManager, child) {
        let target: ProjectGroup = child;
        const groups = this.getAll();

        while (target.parentId != null) {
          const parent = groups.find(({ identifier }) => identifier === target.parentId);

          if (!parent) break;

          target = parent;
        }

        return target !== child ? target : undefined;
      },

      resolveLastInHierarchy(this: GroupManager, parent) {
        let child = parent;

        while (true) {
          const next = this.getChildren(child).at(-1);

          if (!next) {
            return parent !== child ? child : undefined;
          }

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
          // parent, let's ensure the parent is correct.
          child.parentId = parent?.identifier;
        } else if (!parent && child.parentId) {
          // The child might already be an orphan.
          const highestParent = this.resolveHighestParent(child);

          if (highestParent) {
            // The child has a parent, remove it.
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
    } satisfies Omit<GroupManager, 'project' | 'report' | 'database'>,
    {
      put(this: GroupManager, element: ProjectGroup, index?: number) {
        const collection = this.getCollection();

        const length = collection.length ?? 0;
        const includes = collection.includes(element);

        // Use length if index is not provided,
        // also keep within length of collection.
        let target = (((index ?? length) % length) + length) % length;

        // We will get NaN if length is 0.
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
        } else {
          collection.push(element);
        }

        /*
         * A template must never retain hashed values.
         */
        if (this.report.template) {
          stripHashedValues(element);
        }
      },
    } satisfies Pick<GroupManager, 'put'>,
  );
}

function getElementManager(
  project: ProjectManager,
  report: ProjectReport,
  groupId: string,
): ElementManager | undefined {
  const group = report.groups?.find(({ identifier }) => identifier === groupId);

  if (!group) return;

  const MANAGER: Pick<ElementManager, 'project' | 'report' | 'group' | 'database'> = {
    database: project.database,
    group,
    project,
    report,
  };

  return Object.assign(MANAGER, {
    create(partial, index) {
      const data = report.template ? stripHashedClone(partial) : partial;

      const element: ProjectElement = Object.assign(
        {
          identifier: createIdentifier(),
        },
        data,
      ) as ProjectElement;

      element.identifier = createIdentifier();
      this.put(element, index);
      return element;
    },

    delete(this: ElementManager, elementId) {
      const collection = this.getCollection();
      const index = collection.findIndex(({ identifier }) => identifier === elementId);
      return index >= 0 ? collection.splice(index, 1)[0] : undefined;
    },

    getCollection(this: ElementManager) {
      this.group.elements ??= [];
      return this.group.elements;
    },

    update(this: ElementManager, elementId, data) {
      const collection = this.getCollection();
      const element = collection.find(({ identifier }) => identifier === elementId);
      if (!element) return undefined;

      if (this.report.template) data = stripHashedClone(data);
      return Object.assign(element, data);
    },

    ...ReorderManagerDefaults(),
  } satisfies Omit<ElementManager, 'project' | 'report' | 'group' | 'database'>);
}

function stripHashedClone<T>(value: T): T {
  const clone = structuredClone(value);
  stripHashedValues(clone);
  return clone;
}
