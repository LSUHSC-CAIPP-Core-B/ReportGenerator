import { Liquid } from "liquidjs";

import utilitiesPlugin from './utilities';
import renderingPlugin from './rendering';

export function registerPlugins(liquid: Liquid) {

    liquid.plugin(utilitiesPlugin);
    liquid.plugin(renderingPlugin);

}
