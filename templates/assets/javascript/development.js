import { CommandPalette } from './development/commands.js';
import { SocketStatus } from './development/sockets.js';
import { Draggable } from './development/draggable.js';

// Initialize draggable elements
Draggable.init();

// Make the command palette
const commandPalette = new CommandPalette({
    input: document.querySelector('#cmd-search'),
    overlay: document.querySelector('#cmd-palette .cmd-list'),
    macos
});

for (let i = 0; i < 15; i++) {
    commandPalette.addAction({
        label: 'Example entry',
        description: i,
        callback: () => status.reconnect()
    });
}

// Handle socket connections
const status = new SocketStatus();

const element = commandPalette.addAction({
    label: 'Socket Status',
    description: 'Restart Socket',
    closes: false,
    callback: () => status.reconnect()
});

const label = element.querySelector('.label');
const classes = element.querySelector('.icon').classList;
classes.replace('icon-dot', 'icon-cloud-off');

status.setConnectCallback(() => {
    classes.replace('icon-cloud-off', 'icon-cloud-check');
    label.innerText = 'Socket Connected';
});

status.setDisconnectCallback(() => {
    classes.replace('icon-cloud-check', 'icon-cloud-off');
    label.innerText = 'Socket Disconnected';
});