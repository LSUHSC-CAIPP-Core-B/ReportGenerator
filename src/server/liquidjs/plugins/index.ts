import type { Liquid } from 'liquidjs';
import renderingPlugin from './rendering';
import utilitiesPlugin from './utilities';

export function registerPlugins(liquid: Liquid) {
  liquid.plugin(utilitiesPlugin);
  liquid.plugin(renderingPlugin);
}
