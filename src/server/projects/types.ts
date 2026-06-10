export interface ProjectElement {
  identifier: string;
  type: string;
  data: Record<string, any>;
}

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
}

export type ProjectInfo = Pick<ProjectReport, 'title' | 'last_opened'>;

export class ProjectError extends Error {
  name: string = 'ProjectError';
}

export type ProjectAction =
  | {
      type: 'group:create';
      groupId: string;
      parentId: string | null;
      title: string;
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
      options: {
        type: string;
        identifier: string;
        data: Record<string, any>;
      };
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
      data: any;
    };
