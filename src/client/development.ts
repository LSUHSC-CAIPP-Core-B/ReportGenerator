import { CommandPalette } from 'client/development/commands.ts';
import { RPCClient } from 'client/development/rpc-client.ts';
import type { ReportBuilder } from 'client/report/ReportBuilder.ts';
import type { CommandActionVisibility, CommandType } from 'common/commands/types.ts';
import type { DatabaseProjectTreeFile } from 'common/database/types.ts';
import { io } from 'socket.io-client';

// Make the command palette
const commandPalette = new CommandPalette({
  input: document.querySelector('#cmd-search')!,
  macos: (window as any).macos as boolean,
  overlay: document.querySelector('#cmd-palette .cmd-list')!,
});

// Handle socket connections
const status = new RPCClient(io());
const rpc = status.rpc;

const element = commandPalette.addAction(
  {
    callback: () => status.connection.reconnect(),
    closes: false,
    description: 'Restart Socket',
    icon: 'cloud-off',
    label: 'Socket Status',
  },
  false,
);

const label = element.querySelector('.label') as HTMLElement;
const classes = element.querySelector('.icon')!.classList;

status.connection.onConnect(() => {
  classes.replace('icon-cloud-off', 'icon-cloud-check');
  label.innerText = 'Socket Connected';
});

status.connection.onDisconnect(() => {
  classes.replace('icon-cloud-check', 'icon-cloud-off');
  label.innerText = 'Socket Disconnected';
});

// TYPES

type FileGroupKey = 'frame' | 'image' | 'table';

type FileGroupConfig = {
  label: string;
  description: string;
  icon: string;
  types: string[];
};

const FILE_GROUPS: Record<FileGroupKey, FileGroupConfig> = {
  frame: {
    description: 'Choose from Database',
    icon: 'panels-top-left',
    label: 'Add Interactive Page',
    types: ['html', 'pdf'],
  },

  image: {
    description: 'Choose from Database',
    icon: 'image',
    label: 'Add Image',
    types: ['png', 'svg', 'jpeg', 'jpg', 'tiff', 'tif'],
  },

  table: {
    description: 'Choose from Database',
    icon: 'table',
    label: 'Add Table',
    types: ['csv'],
  },
};

type FolderNode = {
  folders: Map<string, FolderNode>;
  files: DatabaseProjectTreeFile[];
};

function createFolder(): FolderNode {
  return {
    files: [],
    folders: new Map(),
  };
}

function addFileToTree(root: FolderNode, file: DatabaseProjectTreeFile) {
  const parts = file.path.split('/').filter(Boolean);
  const name = parts.pop();
  if (!name) return;

  let current = root;

  for (const folder of parts) {
    let next = current.folders.get(folder);

    if (!next) {
      next = createFolder();
      current.folders.set(folder, next);
    }

    current = next;
  }

  current.files.push({
    ...file,
    name,
  });
}

function buildFolderCommand(
  node: FolderNode,
  options: {
    label: string;
    description: string;
    icon?: string;
    visibility?: CommandActionVisibility;
    callback?: (value: unknown) => void;
  },
): CommandType {
  const children: CommandType[] = [];

  for (const [name, folder] of node.folders) {
    children.push(
      buildFolderCommand(folder, {
        callback: options.callback,
        description: options.description,
        icon: 'folder',
        label: name,
        visibility: 'searchable',
      }),
    );
  }

  for (const file of node.files.sort((a, b) => a.name.localeCompare(b.name))) {
    children.push({
      description: node === undefined ? '' : options.description,
      label: file.name,
      truncate: 'start',
      value: {
        id: file.id,
        type: file.type,
      },
    });
  }

  return {
    callback: options.callback,
    description: options.description,
    icon: options.icon,
    label: options.label,
    tab: children,
    visibility: options.visibility ?? 'shown',
  };
}
document.addEventListener('DOMContentLoaded', () => {
  addReportActions((window as any).report);
  addGeneralActions();
  addEventListeners((window as any).report);
});

async function addReportActions(REPORT: ReportBuilder) {
  if (!REPORT) return;

  // const groupManager = REPORT.getGroupManager();
  // const insertManager = REPORT.getPendingInsertManager();
  const files = await rpc.db.files(REPORT.getProjectPath());
  const lookup = new Map<string, FileGroupKey>();

  for (const [key, group] of Object.entries(FILE_GROUPS)) {
    for (const type of group.types) {
      lookup.set(type, key as FileGroupKey);
    }
  }

  const roots = new Map<FileGroupKey, FolderNode>();

  for (const file of files) {
    const type = file.type.toLowerCase();
    const group = lookup.get(type);

    if (!group) continue;
    if (!roots.has(group)) {
      roots.set(group, createFolder());
    }

    addFileToTree(roots.get(group)!, {
      ...file,
      name: file.path.split('/').at(-1) ?? 'Unknown File',
    });
  }

  for (const [key, root] of roots) {
    const config = FILE_GROUPS[key];

    const action = buildFolderCommand(root, {
      callback(value) {
        const file = value as {
          id: string;
          type: string;
        };

        // insertManager.beginPendingElement({
        //   data: {
        //     file: file.id,
        //     type: file.type,
        //   },
        //   type: key,
        // });
      },

      description: config.description,

      icon: config.icon,
      label: config.label,
    });

    commandPalette.addAction({
      ...action,
      callback: action.callback,
      closes: true,
    });
  }

  commandPalette.addAction({
    callback() {
      // insertManager.beginPendingElement({
      //   type: 'description',
      //   data: {},
      // });
    },
    icon: 'list-plus',
    label: 'Add Text Field',
  });

  commandPalette.addAction({
    callback() {
      // groupManager.create({
      //   elements: [],
      //   title: 'New Group',
      // });
    },
    icon: 'group',
    label: 'Add Group',
  });
}

async function addGeneralActions() {
  const projects = await rpc.projects.get();
  const projectIds = await rpc.db.projects();
  const ids = Array.isArray(projectIds) ? projectIds : [projectIds];
  const locals = Array.isArray(projects) ? projects : [projects];

  commandPalette.addAction({
    callback(value) {
      globalThis.location.pathname = value as string;
    },
    icon: 'arrow-left-right',
    label: 'Switch Project',
    tab: locals.map(({ title, path }) => ({
      description: 'Switch project',
      label: title,
      value: path,
    })),
  });

  if (!(window as any).report) {
    commandPalette.addAction({
      callback: async (value) => {
        const result = await rpc.projects.create(value);
        globalThis.location.pathname = result.path;
      },
      icon: 'layers-plus',
      label: 'Create Project',
      tab: ids.map(({ id, path }) => ({
        description: 'Create Project',
        label: path,
        value: id,
      })),
    });
  }
}

function addEventListeners(report: ReportBuilder) {
  if (!report) return;

  const events = [
    'group:create',
    'group:move',
    'group:delete',

    'element:create',
    'element:move',
    'element:update',
    'element:delete',
  ] as const;

  for (const type of events) {
    report.addEventListener(
      type,

      (event: Event) => {
        const e = event as CustomEvent;

        rpc.project.edit(report.getProjectPath(), {
          ...e.detail,
          type,
        });

        console.log(type, e.detail);
      },
    );
  }
}
