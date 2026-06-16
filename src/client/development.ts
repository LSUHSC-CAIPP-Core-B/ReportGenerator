import { io } from 'socket.io-client';
import { CommandPalette } from './development/commands.ts';
import { RPCClient } from './development/rpc-client.ts';
import type { ReportBuilder } from './report/ReportBuilder.ts';

// Make the command palette
const commandPalette = new CommandPalette({
  input: document.querySelector('#cmd-search'),
  macos: (window as any).macos as boolean,
  overlay: document.querySelector('#cmd-palette .cmd-list'),
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
const classes = element.querySelector('.icon').classList;

status.connection.onConnect(() => {
  classes.replace('icon-cloud-off', 'icon-cloud-check');
  label.innerText = 'Socket Connected';
});

status.connection.onDisconnect(() => {
  classes.replace('icon-cloud-check', 'icon-cloud-off');
  label.innerText = 'Socket Disconnected';
});

document.addEventListener('DOMContentLoaded', () => {
  addReportActions(/** @type { ReportBuilder } */ ((window as any).report));
  addGeneralActions();

  addEventListeners(/** @type {ReportBuilder} */ ((window as any).report));
});

function addReportActions(REPORT: ReportBuilder) {
  if (!REPORT) return;
  const groupManager = REPORT.getGroupManager();
  const insertManager = REPORT.getPendingInsertManager();

  rpc.db.files(REPORT.getProjectId()).then((fileIds) => {
    // Centralized config to avoid duplicate objects
    const FILE_GROUPS = {
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

    const paths = {};

    for (const { type: $type, id, path } of fileIds) {
      const type = $type.toLowerCase();

      const key = Object.entries(FILE_GROUPS)
        .filter(([, { types }]) => types.includes(type))
        .map(([key]) => key)
        .find(() => true);

      if (!key) continue;
      const groupLookup = paths[key] ?? {};

      // include root folder
      const [name, ...pathParts] = path.split('/').filter(Boolean).reverse().concat('');

      const $paths = pathParts.map((_val, i, arr) =>
        arr.slice(i).reverse().filter(Boolean).join('/'),
      );

      // last folder (before showing file)
      const last = $paths.at(0);

      for (const $path of $paths)
        if (!groupLookup[$path]) groupLookup[$path] = { files: [], tree: null };

      groupLookup[last].files.push({ id, name, path, type });
      paths[key] = groupLookup;
    }

    function constructTree({
      groups,
      key: $path = '',
      label,
      description,
      icon,
      visibility = 'shown',
    }) {
      const group = groups[$path];
      if (group.tree) return group.tree;

      const folderActions = Object.keys(groups)
        .filter((group) => group !== $path)
        .filter((group) => group.startsWith($path))
        .sort()
        .map((key) => {
          const label = $path ? key.slice($path.length + 1) : key;
          const $vis = !label.includes('/') ? visibility : 'searchable';

          const {
            description: $des,
            icon: $ico,
            tab: $tab,
          } = constructTree({
            description: $path,
            groups,
            icon,
            key,
            label,
            visibility: $vis,
          });

          return {
            description: $des,
            icon: $ico,
            label,
            tab: $tab,
            visibility: $vis,
          };
        });

      const { files } = group;

      const fileActions = files
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ name, id, type }) => ({
          description: $path,
          label: name,
          truncate: 'start',
          value: { id, type },
        }));

      group.tree = {
        description,
        icon: $path === '' ? icon : 'folder',
        label,
        tab: [...folderActions, ...fileActions],
        visibility,
      };

      return group.tree;
    }

    for (const key in paths) {
      const PATH_GROUPS = paths[key];
      const { label, description, icon } = FILE_GROUPS[key];

      const tree = constructTree({ description, groups: PATH_GROUPS, icon, label });

      tree.callback = ({ id: file, type }) => {
        insertManager.beginPendingElement({ data: { file, type }, type: key });
      };

      commandPalette.addAction(tree);
    }

    commandPalette.addAction({
      callback: (_value) => {
        insertManager.beginPendingElement({ type: 'description' });
      },
      icon: 'list-plus',
      label: 'Add Text Field',
    });

    commandPalette.addAction({
      callback: (_value) => {
        groupManager.create({ elements: [], title: 'New Group' });
      },
      icon: 'group',
      label: 'Add Group',
    });
  });
}

async function addGeneralActions() {
  const projects = await rpc.projects.get();
  rpc.db.projects().then((projectIds) => {
    const ids = Array.isArray(projectIds) ? projectIds : [projectIds];
    const locals = Array.isArray(projects) ? projects : [projects];

    commandPalette.addAction({
      callback: (value) => {
        globalThis.location.pathname = value;
      },
      icon: 'arrow-left-right',
      label: 'Switch Project',
      tab: locals.map(({ title, path }) => ({
        description: 'Switch project',
        label: title,
        value: path,
      })),
    });

    if (!(window as any).report)
      commandPalette.addAction({
        callback: async (value) => {
          const { path } = await rpc.projects.create(value);
          globalThis.location.pathname = path;
        },
        icon: 'layers-plus',
        label: 'Create Project',
        tab: ids.map(({ id, path }) => ({
          description: 'Create Project',
          label: path,
          value: id,
        })),
      });
  });
}

/**
 * @param {ReportBuilder} report
 */
function addEventListeners(report: ReportBuilder) {
  if (!report) return;

  report.addEventListener('group:create', (e) => {
    rpc.project.edit(report.getProjectId(), {
      ...e.detail,
      type: 'group:create',
    });
    console.log('Group created', e.detail);
  });

  report.addEventListener('group:move', (e) => {
    rpc.project.edit(report.getProjectId(), {
      ...e.detail,
      type: 'group:move',
    });

    console.log('Group moved', e.detail);
  });
  report.addEventListener('group:delete', (e) => {
    rpc.project.edit(report.getProjectId(), {
      ...e.detail,
      type: 'group:delete',
    });

    console.log('Group deleted', e.detail);
  });

  report.addEventListener('element:create', (e) => {
    rpc.project.edit(report.getProjectId(), {
      ...e.detail,
      type: 'element:create',
    });

    console.log('Element created', e.detail);
  });

  report.addEventListener('element:move', (e) => {
    rpc.project.edit(report.getProjectId(), {
      ...e.detail,
      type: 'element:move',
    });

    console.log('Element moved', e.detail);
  });

  report.addEventListener('element:update', (e) => {
    rpc.project.edit(report.getProjectId(), {
      ...e.detail,
      type: 'element:update',
    });

    console.log('Element updated', e.detail);
  });

  report.addEventListener('element:delete', (e) => {
    rpc.project.edit(report.getProjectId(), {
      ...e.detail,
      type: 'element:delete',
    });

    console.log('Element deleted', e.detail);
  });
}
