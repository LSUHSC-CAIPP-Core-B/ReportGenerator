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

export interface ProjectGroup {
  identifier: string;
  parentId: string | null;
  title: string;
  depth?: number;
  elements: ProjectElement[];
}

export interface ProjectReport {
  title: string;
  last_opened: string | Date;
  groups?: ProjectGroup[];
  project?: string;
  path?: string;
}

export type ProjectDef = Required<Pick<ProjectReport, 'project'>> &
  Partial<Pick<ProjectReport, 'title' | 'path'>>;

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
