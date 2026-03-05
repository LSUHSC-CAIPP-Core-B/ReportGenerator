(() => {

    // create socket connection icon
    const notification = document.createElement('span');
    notification.classList.add('b-socket', 'disconnected');
    document.querySelector('#development').appendChild(notification);

    const socket = io();

    function changeConnectedStatus(connected = true) {
        const classes = notification.classList;
        classes.toggle('connected', connected);
        classes.toggle('disconnected', !connected);
    }

    socket.on('connect', (origin) => {
        changeConnectedStatus(true);
    });

    socket.on('disconnect', (origin) => {
        changeConnectedStatus(false);
    });



})();