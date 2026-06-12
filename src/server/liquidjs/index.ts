import { Liquid } from 'liquidjs';
import { ASSETS_DIRECTORY } from '../constants.ts';
import { registerPlugins } from './plugins/index.ts';

const liquid = new Liquid({
  extname: '.html',
  root: [ASSETS_DIRECTORY],
});

registerPlugins(liquid);

export default liquid;
