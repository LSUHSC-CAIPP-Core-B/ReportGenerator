import type { DatabaseFile, DatabaseProjectTreeFile } from '../database/types.ts';

export type TableData = (string | number)[];

export type CommandAction = {
  callback?: (value: any) => void;
  closes: boolean;
  description?: string;
  element: HTMLElement;
  label: string;
  tab?: CommandAction[];
  value: any;
  visibility: 'shown' | 'always' | 'hidden' | 'searchable';
  parent?: CommandAction;
};

export type CommandActionOptions = Pick<CommandAction, 'label' | 'description' | 'callback'> &
  Pick<Partial<CommandAction>, 'closes' | 'value' | 'visibility'> & {
    icon?: string;
    tab?: CommandActionOptions[];
    truncate?: 'start' | 'end';
  };

export type CommandActionDef = CommandActionOptions & {
  groups?: Record<string, CommandActionOptions>;
};

export type CommandActionStack = {
  actions: CommandAction[];
  parentAction?: CommandAction;
  value: string;
};

// NEW

export type CommandActionVisibility = 'shown' | 'always' | 'hidden' | 'searchable';

export type CommandType = {
  callback?: (value: any) => void;
  description: string;
  icon?: string;
  label: string;
  types?: string[];

  tab?: CommandType[];
  tree?: CommandType;
  visibility?: CommandActionVisibility;

  truncate?: 'start' | 'end';
  value?: object | ((...args: any[]) => any);
};

export type CommandTypeGroup = CommandType &
  CommandActionDef2 & {
    files?: DatabaseProjectTreeFile[];
  };

export type CommandTypeGroups = Record<string, CommandTypeGroup>;

export type CommandActionDef2 = {
  groups?: CommandTypeGroups;
  key?: string;
} & Omit<CommandType, 'types' | 'tree'>;

// NEW

export type CommandNode = {
  label: string;
  description?: string;
  icon?: string;

  children?: CommandNode[];
  value?: unknown;
  callback?: (value: unknown) => void;

  visibility?: CommandActionVisibility;
};

type FolderNode = {
  files: DatabaseProjectTreeFile[];
  folders: Map<string, FolderNode>;
};
