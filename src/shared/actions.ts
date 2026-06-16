import type { ProjectElement } from './models.ts';

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
      options: ProjectElement;
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
