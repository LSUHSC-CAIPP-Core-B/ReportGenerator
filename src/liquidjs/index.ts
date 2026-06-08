import { Liquid } from 'liquidjs';
import { TEMPLATE_DIRECTORY } from '../constants';
import { registerPlugins } from './plugins';

const liquid = new Liquid({
  extname: '.html',
  root: [
    TEMPLATE_DIRECTORY,
    `${TEMPLATE_DIRECTORY}/builtin/`,
    `${TEMPLATE_DIRECTORY}/builtin/partial/`,
    `${TEMPLATE_DIRECTORY}/builtin/meta/`,
  ],
});

registerPlugins(liquid);

export default liquid;
