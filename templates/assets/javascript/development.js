import { CommandPalette } from './development/commands.js';
import { SocketStatus } from './development/sockets.js';
import { ReportBuilder } from './report/ReportBuilder.js';

// Make the command palette
const commandPalette = new CommandPalette({
  input: document.querySelector('#cmd-search'),
  macos,
  overlay: document.querySelector('#cmd-palette .cmd-list'),
});

// Handle socket connections
const status = new SocketStatus();

const element = commandPalette.addAction({
  callback: () => status.reconnect(),
  closes: false,
  description: 'Restart Socket',
  icon: 'cloud-off',
  label: 'Socket Status',
});

const label = element.querySelector('.label');
const classes = element.querySelector('.icon').classList;

status.setConnectCallback(() => {
  classes.replace('icon-cloud-off', 'icon-cloud-check');
  label.innerText = 'Socket Connected';
});

status.setDisconnectCallback(() => {
  classes.replace('icon-cloud-check', 'icon-cloud-off');
  label.innerText = 'Socket Disconnected';
});

document.addEventListener('DOMContentLoaded', () => {
  /** @type { ReportBuilder } */
  const REPORT = window.report;
  const groupManager = REPORT.getGroupManager();
  const insertManager = REPORT.getPendingInsertManager();

  status.socket.emit('db.files', REPORT.getProjectId(), (fileIds) => {
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

    console.log(paths);

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
        groupManager.create({ title: 'New Group' });
      },
      icon: 'group',
      label: 'Add Group',
    });
  });
});
