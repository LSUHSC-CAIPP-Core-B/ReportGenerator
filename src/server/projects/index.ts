import { Config, DataError, JsonDB } from 'node-json-db';
import {
  type ProjectAction,
  type ProjectDef,
  ProjectError,
  type ProjectGroup,
  type ProjectInfo,
  type ProjectReport,
} from '../../shared/index.ts';
import { catchErrorTyped } from '../utilities.ts';

const config = new Config('projects.db', true, true, '/');

class ProjectHandler {
  private readonly database: JsonDB;

  constructor() {
    this.database = new JsonDB(config);
  }

  async getProject(projectId: string) {
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
    return report;
  }

  async getAllProjects() {
    const [, data] = await catchErrorTyped(this.database.getData('/'), [DataError]);

    const projects: ProjectInfo[] = Object.entries(data)
      .map(([path, project]) => [path, project as ProjectReport] as const)
      .filter(([, project]) => typeof project === 'object')
      .map(
        ([path, { title, last_opened }], _i, _arr) => ({ last_opened, path, title }) as ProjectInfo,
      );

    return projects ?? [];
  }

  async createProject({
    project,
    title = project,
    path = project?.toLowerCase(),
  }: ProjectDef): Promise<ProjectInfo> {
    if (typeof project !== 'string') {
      throw new ProjectError('Project id is not a string');
    }

    if (!project?.trim()) {
      throw new ProjectError('Project id is required');
    }

    const exists = await this.database.exists(`/${path}`);
    if (exists) throw new ProjectError(`Project path already exists: ${path}`);

    const report = {
      last_opened: new Date().toISOString(),
      project,
      title,
    } satisfies ProjectReport;

    await this.database.push(`/${path}`, report, true);
    return { ...report, path };
  }

  async replaceReport(projectId: string, report: ProjectReport) {
    if (typeof projectId !== 'string') {
      throw new ProjectError('Project id is not a string');
    }
    if (!projectId?.trim()) {
      throw new ProjectError('Project id is required');
    }

    const path = projectId.toLowerCase();

    const [, existing] = await catchErrorTyped(this.database.getObject<ProjectReport>(`/${path}`));
    if (!existing) throw new ProjectError(`Project doesn't exist: ${projectId}`);

    await this.database.push(
      `/${path}`,
      {
        ...existing,
        ...report,
      },
      true,
    );
  }

  async patchReport(projectId: string, report: Partial<ProjectReport>) {
    if (typeof projectId !== 'string') {
      throw new ProjectError('Project id is not a string');
    }
    if (!projectId?.trim()) {
      throw new ProjectError('Project id is required');
    }

    const path = projectId?.toLowerCase();
    const exists = await this.database.exists(`/${path}`);
    if (!exists) throw new ProjectError(`Project doesn't exist: ${projectId}`);

    await this.database.push(`/${path}`, report, false);

    const [, updated] = await catchErrorTyped(this.database.getObject<ProjectReport>(`/${path}`), [
      DataError,
    ]);

    return updated;
  }

  async deleteProject(projectId: string) {
    if (typeof projectId !== 'string') {
      throw new ProjectError('Project id is not a string');
    }
    if (!projectId?.trim()) {
      throw new ProjectError('Project id is required');
    }

    const path = projectId?.toLowerCase();
    const exists = await this.database.exists(`/${path}`);
    if (!exists) throw new ProjectError(`Project doesn't exist: ${projectId}`);

    await this.database.delete(`/${path}`);
    return true;
  }

  async applyAction(projectId: string, action: ProjectAction) {
    if (typeof projectId !== 'string') {
      throw new ProjectError('Project id is not a string');
    }
    if (!projectId?.trim()) {
      throw new ProjectError('Project id is required');
    }

    const path = projectId.toLowerCase();

    const [error, report] = await catchErrorTyped(
      this.database.getObject<ProjectReport>(`/${path}`),
    );

    if (error) throw new ProjectError(`Error while fetching project: ${projectId}`);

    switch (action.type) {
      case 'group:create': {
        report.groups ??= [];

        report.groups.push({
          elements: [],
          identifier: action.groupId,
          parentId: action.parentId,
          title: action.title,
        });

        break;
      }
      case 'group:move': {
        const groups = report.groups ?? [];
        recomputeDepth(groups);
        const fromIndex = groups.findIndex((g) => g.identifier === action.groupId);

        if (fromIndex === -1) break;
        const movedRoot = groups[fromIndex];
        if (!movedRoot) break;

        const getSubtreeEnd = (start: number) => {
          const baseDepth = groups[start]?.depth ?? 0;
          let i = start + 1;

          while (i < groups.length) {
            if ((groups[i]?.depth ?? 0) <= baseDepth) break;
            i++;
          }

          return i - 1;
        };

        const subtreeEnd = getSubtreeEnd(fromIndex);

        // Entire subtree being moved
        const subtree = groups.slice(fromIndex, subtreeEnd + 1);

        // Prevent moving into own descendant
        const descendantIds = new Set(subtree.slice(1).map((g) => g.identifier));

        if (descendantIds.has(action.targetId)) break;

        // Remove subtree
        groups.splice(fromIndex, subtree.length);

        // Target must be searched AFTER removal
        const targetIndex = groups.findIndex((g) => g.identifier === action.targetId);

        if (targetIndex === -1) {
          groups.splice(fromIndex, 0, ...subtree);
          break;
        }

        const target = groups[targetIndex];
        if (!target) break;

        const hasChildren = (groupId: string) => groups.some((g) => g.parentId === groupId);
        const getTargetSubtreeEnd = (start: number) => {
          const baseDepth = groups[start]?.depth ?? 0;
          let i = start + 1;

          while (i < groups.length) {
            if ((groups[i]?.depth ?? 0) <= baseDepth) break;
            i++;
          }

          return i - 1;
        };

        switch (action.position) {
          case 'inside': {
            // Always becomes child of target
            movedRoot.parentId = target.identifier;

            const insertAt = getTargetSubtreeEnd(targetIndex) + 1;

            // Last child position
            groups.splice(insertAt, 0, ...subtree);

            break;
          }

          case 'before': {
            // Before a parent => detach
            if (hasChildren(target.identifier)) {
              movedRoot.parentId = null;
            } else {
              movedRoot.parentId = target.parentId ?? null;
            }

            groups.splice(targetIndex, 0, ...subtree);
            break;
          }

          case 'after': {
            // if (hasChildren(target.identifier)) {
            //   // After parent => become child of parent
            //   movedRoot.parentId = target.identifier;
            // } else {
            movedRoot.parentId = target.parentId ?? null;
            // }

            const insertAt = getTargetSubtreeEnd(targetIndex) + 1;

            groups.splice(insertAt, 0, ...subtree);
            break;
          }
        }

        recomputeDepth(groups);

        report.groups = groups;

        break;
      }

      case 'group:delete': {
        report.groups = (report.groups ?? []).filter((g) => g.identifier !== action.groupId);

        break;
      }

      case 'element:create': {
        const group = report.groups?.find((g) => g.identifier === action.groupId);
        if (!group) break;

        group.elements.splice(action.index, 0, action.options);

        break;
      }

      case 'element:move': {
        const from = report.groups?.find((g) => g.identifier === action.fromGroupId);
        const to = report.groups?.find((g) => g.identifier === action.toGroupId);

        if (!from || !to) break;

        const idx = from.elements.findIndex((e) => e.identifier === action.elementId);
        if (idx === -1) break;

        const [el] = from.elements.splice(idx, 1);
        to.elements.splice(action.index, 0, el);

        break;
      }

      case 'element:update': {
        report.groups ??= [];

        const element = report.groups
          .flatMap((g) => g.elements)
          .find((e) => e.identifier === action.elementId);

        console.log(element);

        if (!element) break;

        element.data ??= {};
        Object.assign(element.data, action.data);

        console.log(element);

        break;
      }

      case 'element:delete': {
        const group = report.groups?.find((g) => g.identifier === action.groupId);
        if (!group) break;

        group.elements = group.elements.filter((e) => e.identifier !== action.elementId);

        break;
      }
    }

    await this.database.push(`/${path}`, report, true);
    return report;
  }
}

const handler = new ProjectHandler();
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
