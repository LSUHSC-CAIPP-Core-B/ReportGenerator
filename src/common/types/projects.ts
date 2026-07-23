import type { TreeElement } from '../managers/TreeManager.ts';

export type ProjectAction =
  | {
      type: 'group:create';
      options: ProjectGroupDef;
    }
  | {
      type: 'group:move';
      groupId: string;
      targetId: string;
      position: 'before' | 'after' | 'inside';
    }
  | {
      type: 'group:delete';
      groupId: string;
    }
  | {
      type: 'element:create';
      groupId: string;
      index: number;
      options: ProjectElementDef;
    }
  | {
      type: 'element:move';
      elementId: string;
      fromGroupId: string;
      toGroupId: string;
      index: number;
    }
  | {
      type: 'element:delete';
      elementId: string;
      groupId: string;
    }
  | {
      type: 'element:update';
      elementId: string;
      data: Record<string, any>;
    };

export type ProjectActionType<
  T extends ProjectAction['type'],
  P extends keyof ProjectActionExtract<T> = never,
> = ResolvePartial<ProjectActionExtract<T>, P>;

type ProjectActionExtract<T extends ProjectAction['type']> = Extract<ProjectAction, { type: T }>;

type ResolveKeys<T, K extends keyof any> = K extends keyof T ? K : never;
type ResolvePartial<T, K extends keyof any, K2 extends keyof T = ResolveKeys<T, K>> = Omit<T, K2> &
  Partial<Pick<T, K2>>;

// creation values

export type Element = DescriptionElement | FrameElement | ImageElement | TableElement;

export type GenericElement = {
  id: string;
  identifier?: string;
};

export type DescriptionElement = GenericElement & {
  type: 'description';
  data?: {
    description?: string;
  };
};

export type FrameElement = GenericElement & {
  type: 'frame';
  data?: {
    file?: string;
  };
};

export type ImageElement = GenericElement & {
  type: 'image';
  data?: {
    description?: string;
    file?: string;
  };
};

export type TableElement = GenericElement & {
  type: 'table';
  data?: {
    type?: string;
    file?: string;
    extras?: Record<string, any>;
  };
};

export type ElementShell = {
  identifier: string;
  icon?: string;
  details?: string;
};

// database values

export type ProjectElement = Required<Element>;

export type ProjectGroup = {
  identifier: string;
  parentId?: string | null;
  title: string;
  depth?: number;
  elements: ProjectElement[];
} & TreeElement;

export type ProjectReport = {
  title: string;
  last_opened: string | Date;
  groups?: ProjectGroup[];
  identifier: string;
  project?: string;
  path?: string;
};

export type ProjectDef = Required<Pick<ProjectReport, 'project'>> &
  Partial<Pick<ProjectReport, 'title' | 'path'>>;

export type ProjectGroupDef = Required<Pick<ProjectGroup, 'identifier' | 'title'>> &
  Partial<Pick<ProjectGroup, 'parentId'>> & { elements?: ProjectElementDef[] };

export type ProjectElementDef = Omit<ProjectElement, 'id'>;

export type ProjectInfo = Required<Omit<ProjectDef, 'project'>> &
  Pick<ProjectReport, 'last_opened'>;

export type DatabaseFile = {
  id: string;
  path: string;
  type: string;
};

export type DatabaseProject = {
  id: string;
  path: string;
};

export class ProjectError extends Error {
  name: string = 'ProjectError';
}
