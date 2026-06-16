import { createServer } from 'node:http';
import { WEBSERVER_PORT } from './constants.ts';
import { connectDB } from './database/index.ts';
import app from './express.ts';
import { RPCServer } from './rpc-server.ts';

export const server = createServer(app);
new RPCServer(server);

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
