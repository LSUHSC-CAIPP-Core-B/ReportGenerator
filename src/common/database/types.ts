export type DatabaseFile = {
  id: string;
  path: string;
  type: string;
};

export type DatabaseProject = {
  id: string;
  path: string;
};

export type DatabaseProjectTreeFile = DatabaseFile & { name: string };

export type DatabaseProjectTree = {
  files: DatabaseProjectTreeFile[];
  tree?: DatabaseProjectTree;
};
