import { CommandPalette } from './development/commands.js';
import { SocketStatus } from './development/sockets.js';
import { ReportBuilder } from './report/ReportBuilder.js';

// Make the command palette
const commandPalette = new CommandPalette({
    input: document.querySelector('#cmd-search'),
    overlay: document.querySelector('#cmd-palette .cmd-list'),
    macos
});

// Handle socket connections
const status = new SocketStatus();

const element = commandPalette.addAction({
    label: 'Socket Status',
    icon: 'cloud-off',
    description: 'Restart Socket',
    closes: false,
    callback: () => status.reconnect()
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

    status.socket.emit('db.files', REPORT.getProjectId(),
        (fileIds) => {
            // Centralized config to avoid duplicate objects
            const FILE_GROUPS = {
                image: {
                    label: 'Add Image',
                    description: 'Choose from Database',
                    icon: 'image',
                    types: ['png', 'svg', 'jpeg', 'jpg', 'tiff', 'tif']
                },
                table: {
                    label: 'Add Table',
                    description: 'Choose from Database',
                    icon: 'table',
                    types: ['csv']
                },
                frame: {
                    label: 'Add Interactive Page',
                    description: 'Choose from Database',
                    icon: 'panels-top-left',
                    types: ['html', 'pdf']
                }
            };

            const paths = {};

            for ( const { type: $type, id, path } of fileIds ) {
                const type = $type.toLowerCase();

                const key = Object.entries(FILE_GROUPS)
                    .filter(([, { types }]) => types.includes(type))
                    .map(([ key ]) => key).find(() => true);

                if (!key) continue;
                const groupLookup = paths[key] ?? {};


                // include root folder
                const [ name, ...pathParts ] = path.split('/')
                    .filter(Boolean).reverse().concat('');

                const $paths = pathParts.map((_val, i, arr) =>
                    arr.slice(i).reverse().filter(Boolean).join('/')
                );

                // last folder (before showing file)
                const last = $paths.at(0);

                for (const $path of $paths)
                    if (!groupLookup[$path])
                        groupLookup[$path] = { files: [], tree: null };

                groupLookup[last].files.push({ name, type, id, path });
                paths[key] = groupLookup;
            }

            console.log(paths);

            function constructTree({
                groups, key: $path = '',
                label, description, icon,
                visibility = 'shown'
            }) {
                const group = groups[$path];
                if (group.tree) return group.tree;

                const folderActions = Object.keys(groups)
                    .filter(group => group !== $path)
                    .filter(group => group.startsWith($path))
                    .sort().map(key => {
                        const label = $path ? key.slice($path.length + 1) : key;
                        const $vis = !label.includes('/') ? visibility : 'searchable';

                        const {
                            description: $des,
                            icon: $ico,
                            tab: $tab
                        } = constructTree({
                            groups, key, label,
                            description: $path, icon,
                            visibility: $vis
                        });

                        return { 
                            label,
                            description: $des,
                            icon: $ico,
                            visibility: $vis,
                            tab: $tab
                        };
                    });

                const { files } = group;

                const fileActions = files.sort((a, b) => a.name.localeCompare(b.name))
                    .map(({ name, id, type }) => ({
                        label: name,
                        description: $path,
                        value: { id, type },
                        truncate: 'start'
                    }));

                group.tree = {
                    label, description, icon: $path === '' ? icon : 'folder', visibility,
                    tab: [...folderActions, ...fileActions]
                };

                return group.tree;
            }


            for ( const key in paths ) {
                const PATH_GROUPS = paths[key];
                const {label, description, icon} = FILE_GROUPS[key];

                const tree = constructTree({ groups: PATH_GROUPS, label, description, icon });

                tree.callback = ({ id: file, type }) => {
                    insertManager.beginPendingElement({ file, type });
                };

                commandPalette.addAction(tree);
            }

            commandPalette.addAction({
                label: 'Add Text Field',
                icon: 'list-plus',
                callback: (value) => {
                    insertManager.beginPendingElement({ type: 'description' });
                }
            });

            commandPalette.addAction({
                label: 'Add Group',
                icon: 'group',
                callback: (value) => {
                    groupManager.create({ title: 'New Group' });
                }
            });
        }

    );


});
