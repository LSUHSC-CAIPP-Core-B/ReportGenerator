export type TableData = (string | number)[];

export type CommandAction = {
  callback?: (valua: any) => void;
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

export type ElementOptions =
  | DescriptionElementOptions
  | FrameElementOptions
  | ImageElementOptions
  | TableElementOptions;

export type GenericElementOptions = {
  identifier?: string;
};

export type DescriptionElementOptions = GenericElementOptions & {
  type: 'description';
  data?: {
    description?: string;
  };
};

export type FrameElementOptions = GenericElementOptions & {
  type: 'frame';
  data?: {
    file?: string;
  };
};

export type ImageElementOptions = GenericElementOptions & {
  type: 'image';
  data?: {
    description?: string;
    file?: string;
  };
};

export type TableElementOptions = GenericElementOptions & {
  type: 'table';
  data?: {
    type?: string;
    file?: string;
    extras?: Record<string, any>;
  };
};

export type ShellElementOptions = {
  identifier: string;
  icon?: string;
  details?: string;
};
