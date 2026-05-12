import { CommandPalette } from './development/commands.js';
import { SocketStatus } from './development/sockets.js';
import { Draggable } from './development/draggable.js';

// // Initialize draggable elements
// Draggable.init();

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
    const { report: REPORT } = window;

    status.socket.emit('db.files', REPORT.projectId,
        (fileIds) => {
            const files = fileIds.map(({ type, id, path }) => ({
                label: path.substring(path.lastIndexOf('/') + 1),
                description: path,
                value: {id, type},
                type,
                truncate: "start"
            }));

            const images = files.filter(({ type }) => [ 'png', 'svg', 'jpeg', 'jpg', 'tiff', 'tif' ].includes(type.toLowerCase()));
            const tables = files.filter(({ type }) => [ 'csv' ].includes(type.toLowerCase()));
            const frames = files.filter(({ type }) => [ 'html', 'pdf' ].includes(type.toLowerCase()));

            const imageElement = commandPalette.addAction({
                label: 'Add Image',
                description: 'Choose from Database',
                icon: 'image',
                tab: images,
                callback: (value) => {
                    console.log(value);
                },
                closes: true
            });

            const tableElement = commandPalette.addAction({
                label: 'Add Table',
                description: 'Choose from Database',
                icon: 'table',
                tab: tables,
                callback: (value) => {
                    console.log(value);
                },
                closes: true
            });

            const embeddedPageElement = commandPalette.addAction({
                label: 'Add Embedded Page',
                description: 'Choose from Database',
                icon: 'panels-top-left',
                tab: frames,
                callback: (value) => {
                    console.log(value);
                },
                closes: true
            });
            
            
            commandPalette.addAction({
                label: 'Add Text Field',
                icon: 'list-plus',
                callback: (value) => {
                }
            });
        }
    );


});
