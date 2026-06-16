import type { ProjectElement } from './models.ts';

export type ProjectAction =
  | {
      type: 'group:create';
      groupId: string;
      parentId: string | null;
      title: string;
      elements?: ProjectElement[];
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

export type ProjectActionType<
  T extends ProjectAction['type'],
  P extends keyof ProjectActionExtract<T> = never,
> = ResolvePartial<ProjectActionExtract<T>, P>;

type ProjectActionExtract<T extends ProjectAction['type']> = Extract<ProjectAction, { type: T }>;

type ResolveKeys<T, K extends keyof any> = K extends keyof T ? K : never;
type ResolvePartial<T, K extends keyof any, K2 extends keyof T = ResolveKeys<T, K>> = Omit<T, K2> &
  Partial<Pick<T, K2>>;
