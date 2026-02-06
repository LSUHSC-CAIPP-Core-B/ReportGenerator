import { Server } from 'socket.io';
import { server } from './app';

const io = new Server(server);

io.on('connection', (socket) => {
    console.log('New connection: ' + socket.id);
});


