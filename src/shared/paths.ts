export function buildDatabasePath(projectId: string, fileId: string, extra = '') {
  return `/database/${projectId}/${fileId}/${extra}`;
}
