import { WEBSERVER_PORT } from './constants';
import server from './server';

server.listen(WEBSERVER_PORT, (err) => {
  if (err) throw err;
  console.log(`Listening on http://127.0.0.1:${WEBSERVER_PORT}`);
});
