import { Context, Emitter, evalToken, Liquid, Parser, Tag, TagToken, TokenKind, TopLevelToken, Value } from 'liquidjs';
import { TagImplOptions } from 'liquidjs/dist/template';

export default function (this: Liquid, L: typeof Liquid) {
  this.registerTag('component', componentTagOptions);

  this.registerTag('attribute', attributeTagOptions);
  this.registerTag('element', elementTagOptions);
}



const componentTagOptions: TagImplOptions = {
  parse(this: Tag & TagImplOptions, tagToken: TagToken, remainingTokens: TopLevelToken[]) {
    const [namePart, ...rest] = tagToken.args.split(/,\s*/g);

    this.templateName = namePart.trim().replace(/^["']|["']$/g, '');

    // Parse props
    this.props = {};
    this.hasSlot = false;

    rest.forEach(pair => {
      const [key, value] = pair.split(':').map(s => s.trim());
      if (key && value) this.props[key] = value;
      else if (key == 'hascontents') this.hasSlot = true;
    });

    // Handle block content (slot)
    const tokens: TopLevelToken[] = [];
    if (this.hasSlot) {
      let token: TopLevelToken | undefined;
      while ((token = remainingTokens.shift())) {
        if (token instanceof TagToken && token.name === 'endcomponent') break;
        tokens.push(token);
      }
    }

    this.templates = (this.liquid.parser ?? this.parser).parseTokens(tokens);
  },
  render: function*(this: Tag & TagImplOptions, ctx: Context, emitter: Emitter, hash: Record<string, any>) {
    if ('if' in this.props) {
      const condition = this.liquid.evalValueSync(this.props['if'], ctx);
      if (!condition) return '';
      delete this.props['if'];
    }

    // Evaluate props
    const evaluatedProps: Record<string, any> = {};

    for (const [key, value] of typedEntries<string>(this.props)) {
      evaluatedProps[key] = this.liquid.evalValueSync(value, ctx);
    }

    // Render slot content
    let content: any;
    if (this.templates.length > 0) {
      content = this.liquid.renderer.renderTemplates(this.templates, ctx);
    }

    // Create isolated scope
    const scope = {...evaluatedProps, content};

    // Render component file with scoped data
    return this.liquid.renderFileSync(`components/${this.templateName}`, scope);
  }
}

const attributeTagOptions: TagImplOptions = {
  parse(this: Tag & TagImplOptions, tagToken: TagToken, remainingTokens: TopLevelToken[]) {
    this.props = {};

    tagToken.args.split(/,\s*/).forEach(pair => {
      const [key, value] = pair.split(':').map(s => s.trim());
      if (key && value) this.props[key] = value;
    });
  },
  render: function*(this: Tag & TagImplOptions, ctx: Context, emitter: Emitter, hash: Record<string, any>) {
    if ('if' in this.props) {
      const condition = this.liquid.evalValueSync(this.props['if'], ctx);
      if (!condition) return '';
    }

    const name: string = this.props.name
      ? yield this.liquid.evalValueSync(this.props.name, ctx) : null;
    const value: string | boolean = this.props.value
      ? yield this.liquid.evalValueSync(this.props.value, ctx) : null;

    if (!name) return "";
    
    const attrs = ctx.getRegister("attrs") || {};
    
    const hasValue = this.props.value !== undefined;
    const exists = (attrs[name] !== undefined);
    const genericBool = (attrs[name] === true || attrs[name] === false);
    const genericSet = (value === "" || !hasValue);

    if (exists && genericBool) attrs[name] = (attrs[name] || value) != false;
    else if (exists && !genericSet) attrs[name] = `${attrs[name]} ${value}`;
    else attrs[name] = (genericSet) ? '' : value;

    ctx.setRegister("attrs", attrs);

    return '';
  }
}

const elementTagOptions: TagImplOptions = {
  parse(this: Tag & TagImplOptions, tagToken: TagToken, remainingTokens: TopLevelToken[]) {
    const [tagNamePart, ...rest] = tagToken.args.split(/,\s*/);

    this.tagName = new Value(tagNamePart.trim(), this.liquid);

    this.props = {};
    this.self = false;

    rest.forEach(pair => {
      const [key, value] = pair.split(':').map(s => s.trim());
      if (key && value) this.props[key] = value;
      else if (key == 'self') this.self = true;
    });

    // Handle block content (slot)
    const tokens: TopLevelToken[] = [];
    let token: TopLevelToken | undefined;
    while ((token = remainingTokens.shift())) {
      if (token instanceof TagToken && token.name === 'endelement') break;
      tokens.push(token);
    }

    this.templates = (this.liquid.parser ?? this.parser).parseTokens(tokens);
  },
  render: function*(this: Tag & TagImplOptions, ctx: Context, emitter: Emitter, hash: Record<string, any>) {
    const tagName: string = yield this.tagName.value(ctx);
    if (!tagName) return '';

    if ('if' in this.props) {
      const condition = this.liquid.evalValueSync(this.props['if'], ctx);
      if (!condition) return '';
      delete this.props['if'];
    }

    // Evaluate props
    let attrs: Record<string, any> = {};

    for (const [key, value] of typedEntries<string>(this.props)) {
      const evaluated: string | boolean = this.liquid.evalValueSync(value, ctx);
      attrs[key] = (evaluated === true || evaluated === "") ? true : evaluated;
    }

    // Reset attribute register
    let attrArr: string[] = [];
    ctx.setRegister("attrs", attrs);
    const children: string = yield this.liquid.renderer.renderTemplates(this.templates, ctx);
    attrs = ctx.getRegister("attrs") || {};

    for (const [key, value] of typedEntries<string | boolean>(attrs)) {
      const evaluated: string | boolean = value;
      if (evaluated === false || evaluated === null) continue;
      else if (evaluated === '') attrArr.push(` ${key}`);
      else attrArr.push(` ${key}="${evaluated}"`);
    }

    return (this.self) ? `<${tagName}${attrArr.join('')} />`
      : `<${tagName}${attrArr.join('')}>${children}</${tagName}>`;
  }
}






function typedEntries<T>(obj: Record<string, T>) {
  return Object.entries(obj) as [string, T][];
}
