import { Context, Liquid, TagToken, TopLevelToken, Value } from "liquidjs";


/**
 * Inside the plugin function, `this` refers to the Liquid instance.
 */
export default function (this: Liquid, L: typeof Liquid) {
  this.registerTag('randomid', {
    render: function*(ctx: Context) {
      return new Array(32).fill('0123456789abcdef').map(a => a[Math.floor(a.length * Math.random())]).join('');
    }
  });
}
