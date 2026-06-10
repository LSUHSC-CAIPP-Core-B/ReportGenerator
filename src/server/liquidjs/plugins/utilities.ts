import type { Context, Liquid } from 'liquidjs';
import type { TagImplOptions } from 'liquidjs/dist/template';

/**
 * Inside the plugin function, `this` refers to the Liquid instance.
 */
export default function (this: Liquid, _L: typeof Liquid) {
  this.registerFilter('titlecase', toTitleCase);
  this.registerTag('randomid', randomIDTagOptions);
  this.registerFilter('env', fetchEnvironmentVariable);
}

function toTitleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    (match) => match.charAt(0).toUpperCase() + match.substring(1).toLowerCase(),
  );
}

const randomIDTagOptions: TagImplOptions = {
  render: function* (_ctx: Context) {
    return new Array(32)
      .fill('0123456789abcdef')
      .map((a) => a[Math.floor(a.length * Math.random())])
      .join('');
  },
};

function fetchEnvironmentVariable(key: string, fallback: string = '') {
  const val = process.env[key] ?? fallback;

  // convert to bool if needed
  return val.match(/^true$/i)
    ? true
    : val.match(/^false$/i)
      ? false
      : // otherwise if number, convert it
        val.match(/^\d+(?:\.\d+)$/)
        ? Number.parseFloat(val)
        : // otherwise return the value
          val;
}
