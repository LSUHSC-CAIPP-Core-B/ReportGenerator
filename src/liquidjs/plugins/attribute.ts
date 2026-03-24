import { Context, Liquid, TagToken, TopLevelToken, Value } from "liquidjs";

export default function (this: Liquid, L: typeof Liquid) {
  this.registerTag("attribute", {
    parse(tagToken: TagToken, remainTokens: TopLevelToken[]) {
      this.args = {};

      // Match key: value pairs
      const regex = /(\w+)\s*:\s*("[^"]*"|'[^']*'|\S+)/g;
      let match;

      while ((match = regex.exec(tagToken.args)) !== null) {
        const key = match[1];
        const rawValue = match[2];

        // Store as evaluatable Liquid expression
        this.args[key] = new Value(rawValue, this.liquid);
      }
    },

    render: function* (ctx: Context) {
      const name: string = this.args.name
        ? yield this.args.name.value(ctx)
        : null;

      const value: string | boolean = this.args.value
        ? yield this.args.value.value(ctx)
        : null;

      if (!name || value === false) return "";
      else if (value === true || value === "") return `${name}`;
      return `${name}="${value}"`;
    }
  });
}