import { Liquid } from 'liquidjs';
import { ASSETS_DIRECTORY } from '../constants';
import { registerPlugins } from './plugins';

const liquid = new Liquid({
  extname: '.html',
  root: [ASSETS_DIRECTORY],
});

registerPlugins(liquid);

export default liquid;
