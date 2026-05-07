
(() => {

    // Make the command palette
    const commandPalette = new CommandPalette({
        input: document.querySelector('#cmd-search'),
        overlay: document.querySelector('#cmd-palette .cmd-list')
    });



    for (let i = 0; i < 5; i++) {
        commandPalette.addAction({
            label: 'Example entry: ' + i,
            callback: () => status.reconnect()
        });
    }



    // Handle socket connections
    const status = new SocketStatus();
    
    const element = commandPalette.addAction({
        label: 'Socket Status',
        description: 'Restart Socket',
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
})();
