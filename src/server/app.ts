import { createServer } from 'node:http';
import { env } from './config/env.ts';
import app from './express.ts';
import { RPCServer } from './rpc.ts';

export const server = createServer(app);
new RPCServer(server);

server.listen(env.WEBSERVER_PORT, async () => {
  console.log(`Listening on http://127.0.0.1:${env.WEBSERVER_PORT}`);
});
