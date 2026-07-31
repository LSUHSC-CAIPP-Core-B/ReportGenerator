import type { TreeElement } from '../managers/TreeManager.ts';

export type ProjectActions =
  | {
      type: 'group:create';
      client: ProjectGroupDef;
      server: ProjectGroup;
    }
  | {
      type: 'group:move';
      client: ProjectAction$MoveGroup;
      server: ProjectAction$MoveGroup;
    }
  | {
      type: 'group:delete';
      client: ProjectAction$DeleteGroup;
      server: ProjectAction$DeleteGroup;
    }
  | {
      type: 'element:create';
      client: ProjectAction$CreateElement$Client;
      server: ProjectAction$CreateElement$Server;
    }
  | {
      type: 'element:move';
      client: ProjectAction$MoveElement;
      server: ProjectAction$MoveElement;
    }
  | {
      type: 'element:delete';
      client: ProjectAction$DeleteElement;
      server: ProjectAction$DeleteElement;
    }
  | {
      type: 'element:update';
      client: ProjectAction$UpdateElement;
      server: ProjectAction$UpdateElement;
    };

export type ProjectAction$MoveGroup = {
  groupId: string;
  targetId: string;
  position: 'before' | 'after' | 'inside';
};

export type ProjectAction$DeleteGroup = {
  groupId: string;
};

export type ProjectAction$CreateElement$Client = {
  groupId: string;
  options: ProjectElementDef;
  // index: number;
};

export type ProjectAction$CreateElement$Server = {
  groupId: string;
  options: ProjectElement;
  // index: number;
};

export type ProjectAction$MoveElement = {
  elementId: string;
  fromGroupId: string;
  toGroupId: string;
  index: number;
};

export type ProjectAction$DeleteElement = {
  elementId: string;
  groupId: string;
};

export type ProjectAction$UpdateElement = {
  elementId: string;
  data: Record<string, any>;
};

type ProjectActions$Resolve<Lookup extends ('client' | 'server') & string> = {
  [Type in ProjectActions['type']]: {
    type: Extract<ProjectActions, { type: Type }>['type'];
    data: Extract<ProjectActions, { type: Type }>[Lookup];
  };
}[ProjectActions['type']];

export type ProjectActions$Client = ProjectActions$Resolve<'client'>;
export type ProjectActions$Server = ProjectActions$Resolve<'server'>;

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
  parentId?: string;
  title: string;
  depth?: number;
  elements: ProjectElement[];
} & TreeElement;

export type ProjectReport = {
  title: string;
  last_opened: string | Date;
  groups?: ProjectGroup[];
  project?: string;
  path?: string;
};

export type ProjectDef = Partial<Pick<ProjectReport, 'title' | 'path' | 'project'>>;

export type ProjectGroupDef = Required<Pick<ProjectGroup, 'title'>> &
  Partial<Pick<ProjectGroup, 'parentId'>> & { elements?: ProjectElementDef[] };

export type ProjectElementDef = Omit<ProjectElement, 'identifier'>;

export type ProjectInfo = Required<Omit<ProjectReport, 'project' | 'groups'>> &
  Pick<ProjectReport, 'project'>;

export class ProjectError extends Error {
  name: string = 'ProjectError';
}
