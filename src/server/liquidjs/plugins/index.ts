import type { Liquid } from 'liquidjs';
import renderingPlugin from './rendering.ts';
import utilitiesPlugin from './utilities.ts';

export function registerPlugins(liquid: Liquid) {
  liquid.plugin(utilitiesPlugin);
  liquid.plugin(renderingPlugin);
}
