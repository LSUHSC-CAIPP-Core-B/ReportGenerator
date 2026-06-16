export const SOCKET_EVENTS = {
  DB_FILES: 'db.files',
  DB_PROJECTS: 'db.projects',
  LOCAL_PROJECT: 'local.project',
  LOCAL_PROJECTS: 'local.projects',
} as const;

export type SocketEventMap = typeof SOCKET_EVENTS;

export class ProjectError extends Error {
  name: string = 'ProjectError';
}
