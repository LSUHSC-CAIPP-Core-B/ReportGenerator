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

export type CommandActionStack = {
  actions: CommandAction[];
  parentAction?: CommandAction;
  value: string;
};
