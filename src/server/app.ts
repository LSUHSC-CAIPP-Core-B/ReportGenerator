import { createServer } from 'node:http';
import { env } from 'server/config/env.ts';
import { connectDB } from 'server/database/connection.ts';
import app from 'server/express.ts';
import { RPCServer } from 'server/rpc.ts';

export const server = createServer(app);
new RPCServer(server);

server.listen(env.WEBSERVER_PORT, async () => {
  try {
    console.log(`Listening on http://127.0.0.1:${env.WEBSERVER_PORT}`);
    await connectDB();
  } catch (e) {
    console.error(e);
    await new Promise((resolve: (value: number) => void, reject) => {
      server.close((err) => (err ? reject(err) : resolve(1)));
    }).then(() => process.exit(1));
  }
});
