import { Liquid } from "liquidjs";


/**
 * Inside the plugin function, `this` refers to the Liquid instance.
 */
export default function (this: Liquid, L: typeof Liquid) {
    this.registerFilter('titlecase', toTitleCase);
}

function toTitleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    match => match.charAt(0).toUpperCase() + match.substring(1).toLowerCase()
  );
}