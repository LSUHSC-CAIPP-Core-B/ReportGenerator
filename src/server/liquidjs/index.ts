import { Liquid } from 'liquidjs';
import { env } from 'server/config/env.ts';
import { registerPlugins } from './plugins/index.ts';

const liquid = new Liquid({
  extname: '.html',
  root: [env.ASSETS_DIRECTORY],
});

registerPlugins(liquid);

export default liquid;
