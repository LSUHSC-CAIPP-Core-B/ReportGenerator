import { type Command, CommandExecutor, CommandRegistry } from '@sebastian-sereno/command-palette';
import { RPCClient } from 'client/development/rpc-client.ts';
import type { ReportBuilder } from 'client/report/ReportBuilder.ts';
import type { DatabaseProjectTreeFile } from 'common/database/types.ts';
import { io } from 'socket.io-client';

// -----------------------------------------------------------------------------
// Command execution and UI
// -----------------------------------------------------------------------------

const input = document.querySelector<HTMLInputElement>('#cmd-search')!;
const commandList = document.querySelector<HTMLElement>('#cmd-palette .cmd-list')!;

const registry = new CommandRegistry();
const executor = new CommandExecutor(registry, {
  enabled: true,
  maxEntries: 100,
});

const status = new RPCClient(io());
const rpc = status.rpc;

let socketConnected = false;
let activeIndex = 0;

function registerCommand(command: Command) {
  registry.registerCommand(command);
}

function createCommand(
  overrides: Partial<Command> & Pick<Command, 'id' | 'title' | 'execute'>,
): Command {
  return {
    category: [],
    description: '',
    keywords: [],
    shortcut: '',
    ...overrides,
  };
}

function renderCommands() {
  const query = input.value.trim();
  const results = executor.search.query(query, { limit: 50 });

  commandList.replaceChildren();
  activeIndex = Math.min(activeIndex, Math.max(0, results.length - 1));

  results.forEach((result, index) => {
    const command = result.command;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cmd-item';

    if (index === activeIndex) {
      button.classList.add('active');
    }

    const title = document.createElement('span');
    title.className = 'label';
    title.textContent = command.title;

    const description = document.createElement('span');
    description.className = 'description';
    description.textContent = command.description;

    button.append(title, description);

    button.addEventListener('mouseenter', () => {
      activeIndex = index;
      updateActiveItem();
    });

    button.addEventListener('click', () => {
      void runCommand(command.id);
    });

    commandList.append(button);
  });
}

function updateActiveItem() {
  const items = commandList.querySelectorAll<HTMLElement>('.cmd-item');

  items.forEach((item, index) => {
    item.classList.toggle('active', index === activeIndex);
  });
}

async function runCommand(id: string) {
  const result = await executor.execute(id, {});

  if (!result.success && !result.cancelled) {
    console.error(`Command "${id}" failed:`, result.error);
  }

  renderCommands();
}

input.addEventListener('input', () => {
  activeIndex = 0;
  renderCommands();
});

input.addEventListener('keydown', (event: KeyboardEvent) => {
  const items = commandList.querySelectorAll('.cmd-item');

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      updateActiveItem();
      break;

    case 'ArrowUp':
      event.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActiveItem();
      break;

    case 'Enter': {
      event.preventDefault();
      const item = items[activeIndex] as HTMLElement | undefined;
      item?.click();
      break;
    }

    case 'Escape':
      input.value = '';
      activeIndex = 0;
      renderCommands();
      break;
  }
});

// -----------------------------------------------------------------------------
// Socket status
// -----------------------------------------------------------------------------

registerCommand(
  createCommand({
    category: ['system', 'connection'],
    description: 'Check the connection or reconnect to the server',
    execute: () => status.connection.reconnect(),
    id: 'socket-reconnect',
    keywords: ['socket', 'reconnect', 'connection', 'server', 'status'],
    title: 'Socket Status',
  }),
);

status.connection.onConnect(() => {
  socketConnected = true;
  updateSocketCommand();
});

status.connection.onDisconnect(() => {
  socketConnected = false;
  updateSocketCommand();
});

function updateSocketCommand() {
  const description = socketConnected
    ? 'Socket Connected — select to reconnect'
    : 'Socket Disconnected — select to reconnect';

  // Register a separate status command so the command registry's
  // registration API remains the only command-management interface.
  //
  // The socket-reconnect command itself always performs the reconnect.
  // Update the visible status independently of the command definition.
  const statusElement = commandList.querySelector<HTMLElement>(
    '[data-command-id="socket-reconnect"] .description',
  );

  if (statusElement) {
    statusElement.textContent = description;
  }

  renderCommands();
}

// -----------------------------------------------------------------------------
// Report file commands
// -----------------------------------------------------------------------------

type FileGroupKey = 'frame' | 'image' | 'table';

type FileGroupConfig = {
  label: string;
  description: string;
  icon: string;
  types: string[];
};

const FILE_GROUPS: Record<FileGroupKey, FileGroupConfig> = {
  frame: {
    description: 'Choose an interactive page from the database',
    icon: 'panels-top-left',
    label: 'Add Interactive Page',
    types: ['html', 'pdf'],
  },

  image: {
    description: 'Choose an image from the database',
    icon: 'image',
    label: 'Add Image',
    types: ['png', 'svg', 'jpeg', 'jpg', 'tiff', 'tif'],
  },

  table: {
    description: 'Choose a table from the database',
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

  for (const folderName of parts) {
    let next = current.folders.get(folderName);

    if (!next) {
      next = createFolder();
      current.folders.set(folderName, next);
    }

    current = next;
  }

  current.files.push({
    ...file,
    name,
  });
}

function registerFileCommands(
  node: FolderNode,
  group: FileGroupKey,
  config: FileGroupConfig,
  report: ReportBuilder,
  folders: string[] = [],
) {
  const folderNames = [...folders];

  for (const file of [...node.files].sort((a, b) => a.name.localeCompare(b.name))) {
    const fileId = String(file.hash);
    const fileType = file.type.toLowerCase();
    const filePath = [...folderNames, file.name].join('/');
    const commandId = `report-file:${group}:${fileId}`;

    try {
      registerCommand(
        createCommand({
          category: ['report', group, ...folderNames],
          description: `${config.description} · ${filePath}`,
          execute: () => {
            // Connect the existing report insertion logic here when its
            // pending-element API is available.
            //
            // Example:
            // report.getPendingInsertManager().beginPendingElement({
            //   type: group,
            //   data: { file: file.id, type: file.type },
            // });

            report.getLayoutManager();

            return {
              file: fileId,
              group,
              type: fileType,
            };
          },
          id: commandId,
          keywords: [config.label, group, file.name, fileType, ...folderNames, filePath],
          title: file.name,
        }),
      );
    } catch (ignored) {}
  }

  const sortedFolders = [...node.folders.entries()].sort(([a], [b]) => a.localeCompare(b));

  for (const [name, folder] of sortedFolders) {
    registerFileCommands(folder, group, config, report, [...folderNames, name]);
  }
}

async function addReportActions(report: ReportBuilder) {
  if (!report) return;

  const files = await rpc.db.files(report.getProjectPath());
  const lookup = new Map<string, FileGroupKey>();

  for (const [key, group] of Object.entries(FILE_GROUPS)) {
    for (const type of group.types) {
      lookup.set(type, key as FileGroupKey);
    }
  }

  const roots = new Map<FileGroupKey, FolderNode>();

  for (const file of files) {
    const group = lookup.get(file.type.toLowerCase());
    if (!group) continue;
    if (!roots.has(group)) roots.set(group, createFolder());

    const fileName = file.path.substring(file.path.lastIndexOf('/'));
    addFileToTree(roots.get(group)!, { ...file, name: fileName });
  }

  for (const [key, root] of roots) {
    registerFileCommands(root, key, FILE_GROUPS[key], report);
  }

  registerCommand(
    createCommand({
      category: ['report', 'edit'],
      description: 'Add a text field to the report',
      execute: () => {
        // Connect the pending-element insertion API here.
      },
      id: 'report-add-text',
      keywords: ['text', 'field', 'description', 'insert'],
      title: 'Add Text Field',
    }),
  );

  registerCommand(
    createCommand({
      category: ['report', 'edit'],
      description: 'Create a new group in the report',
      execute: () => {
        // Connect the group manager API here.
      },
      id: 'report-add-group',
      keywords: ['group', 'new', 'create'],
      title: 'Add Group',
    }),
  );
}

// -----------------------------------------------------------------------------
// General project commands
// -----------------------------------------------------------------------------

async function addGeneralActions() {
  const projects = await rpc.projects.get();
  const projectIds = await rpc.db.projects();

  const ids = Array.isArray(projectIds) ? projectIds : [projectIds];
  const locals = Array.isArray(projects) ? projects : [projects];

  for (const project of locals) {
    registerCommand(
      createCommand({
        category: ['project', 'navigation'],
        description: `Open project ${project.title}`,
        execute: () => {
          globalThis.location.pathname = project.path;
        },
        id: `switch-project:${project.path}`,
        keywords: ['switch', 'project', project.title, project.path],
        title: `Switch Project: ${project.title}`,
      }),
    );
  }

  if (!(window as { report?: ReportBuilder }).report) {
    for (const project of ids) {
      registerCommand(
        createCommand({
          category: ['project', 'create'],
          description: 'Create a project',
          execute: async () => {
            const result = await rpc.projects.create(project.id);
            globalThis.location.pathname = result.path;
          },
          id: `create-project:${project.id}`,
          keywords: ['create', 'new', 'project', project.path],
          title: `Create Project: ${project.path}`,
        }),
      );
    }
  }
}

// -----------------------------------------------------------------------------
// Report event synchronization
// -----------------------------------------------------------------------------

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
    report.addEventListener(type, (event: Event) => {
      const customEvent = event as CustomEvent;

      void rpc.project.edit(report.getProjectPath(), {
        ...customEvent.detail,
        type,
      });

      console.log(type, customEvent.detail);
    });
  }
}

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  const report = (window as { report?: ReportBuilder }).report;

  try {
    await addGeneralActions();

    if (report) {
      await addReportActions(report);
      addEventListeners(report);
    }

    renderCommands();
  } catch (error) {
    console.error('Failed to initialize commands:', error);
  }
});
