export type Message = 'hello' | 'oh';

export type SocketEvent =
  | { type: 'group:create'; payload: { groupId: string; parentId: string | null; title: string } }
  | {
      type: 'group:move';
      payload: { groupId: string; targetId: string; position: 'before' | 'after' | 'inside' };
    }
  | { type: 'group:delete'; payload: { groupId: string } }
  | { type: 'element:create'; payload: { groupId: string; index: number; element: any } }
  | { type: 'element:update'; payload: { elementId: string; data: Partial<unknown> } }
  | { type: 'element:delete'; payload: { groupId: string; elementId: string } };

export const EXAMPLE_EVENT: SocketEvent = {
  payload: {
    element: {},
    groupId: '',
    index: 0,
  },
  type: 'element:create',
};
