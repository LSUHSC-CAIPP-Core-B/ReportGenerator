import { createServer } from 'node:http';
import { WEBSERVER_PORT } from './constants';
import { connectDB } from './database';
import app from './express';

export const server = createServer(app);
import './sockets';

server.listen(WEBSERVER_PORT, async () => {
  try {
    console.log(`Listening on http://127.0.0.1:${WEBSERVER_PORT}`);
    await connectDB();
  } catch (e) {
    console.error(e);
    await new Promise((resolve: (value: number) => void, reject) => {
      server.close((err) => (err ? reject(err) : resolve(1)));
    }).then(() => process.exit(1));
  }
});
