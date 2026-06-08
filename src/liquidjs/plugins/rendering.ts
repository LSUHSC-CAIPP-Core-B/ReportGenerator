import {
  type Context,
  type Emitter,
  type Liquid,
  type Tag,
  TagToken,
  type TopLevelToken,
  Value,
} from 'liquidjs';
import type { TagImplOptions, Template } from 'liquidjs/dist/template';

export default function (this: Liquid, _L: typeof Liquid) {
  // this.registerTag('component', componentTagOptions);

  this.registerTag('attribute', attributeTagOptions);
  this.registerTag('element', elementTagOptions);
}

const _componentTagOptions: TagImplOptions = {
  parse(this: Tag & TagImplOptions, tagToken: TagToken, remainingTokens: TopLevelToken[]) {
    const [namePart, ...rest] = tagToken.args.split(/\s*,\s*/g);

    this.templateName = namePart.trim().replace(/^["']|["']$/g, '');

    // Parse attributes
    this.attributes = parseAttributes(rest);

    this.templates = !('hascontents' in this.attributes)
      ? []
      : parseTemplates(this, remainingTokens, 'endcomponent');
  },
  render: function* (
    this: Tag & TagImplOptions,
    ctx: Context,
    _emitter: Emitter,
    _hash: Record<string, any>,
  ) {
    if (!evalRenderCondition(this, ctx)) return '';

    // Evaluate attributes (for the template root)
    const properties = evalAttributes(this, ctx, this.attributes);

    // Reset attribute register
    const prevRegister: [string, any][] = ctx.saveRegister('attrs');
    ctx.setRegister('attrs', {});
    const content: string = yield renderTemplates(this, ctx, this.templates);
    const attributes = ctx.getRegister('attrs') ?? {};
    ctx.restoreRegister(prevRegister);

    // Create isolated scope
    const scope = { ...ctx.environments, ...properties, attributes, content };

    // Render component file with scoped data
    return this.liquid.renderFileSync(`components/${this.templateName}`, scope);
  },
};

const attributeTagOptions: TagImplOptions = {
  parse(this: Tag & TagImplOptions, tagToken: TagToken, _remainingTokens: TopLevelToken[]) {
    this.attributes = parseAttributes(tagToken.args.split(/\s*,\s*/));
  },
  render: function (
    this: Tag & TagImplOptions,
    ctx: Context,
    _emitter: Emitter,
    _hash: Record<string, any>,
  ) {
    if (!evalRenderCondition(this, ctx)) return '';

    const name = evalValue<string>(this, ctx, this.attributes.name);
    const value = evalValue<string | boolean>(this, ctx, this.attributes.value) ?? '';

    if (!name) return '';

    const attributes = ctx.getRegister('attrs') || {};
    resolveAttribute(attributes, { name, value }, this.attributes);
    ctx.setRegister('attrs', attributes);

    return '';
  },
};

const elementTagOptions: TagImplOptions = {
  parse(this: Tag & TagImplOptions, tagToken: TagToken, remainingTokens: TopLevelToken[]) {
    const [elementName, ...rest] = tagToken.args.split(/\s*,\s*/);
    this.elementName = new Value(elementName.trim(), this.liquid);

    this.attributes = parseAttributes(rest);

    // Handle block content (slot)
    this.templates = parseTemplates(this, remainingTokens, 'endelement');
  },
  render: function* (
    this: Tag & TagImplOptions,
    ctx: Context,
    _emitter: Emitter,
    _hash: Record<string, any>,
  ) {
    if (!evalRenderCondition(this, ctx)) return '';
    const name = this.elementName.value(ctx);
    if (!name) return '';

    const self = 'nocontent' in this.attributes;
    if (self) delete this.attributes.nocontent;

    // Evaluate attributes
    let attributes = evalAttributes(this, ctx, this.attributes);

    // Add additional attributes
    if (attributes.attributes) {
      appendAttributes(attributes, attributes.attributes);
      delete attributes.attributes;
    }

    // Reset attribute register
    const prevRegister: [string, any][] = ctx.saveRegister('attrs');
    ctx.setRegister('attrs', attributes);
    const content: string = yield renderTemplates(this, ctx, this.templates);
    attributes = ctx.getRegister('attrs') || {};
    ctx.restoreRegister(prevRegister);

    const htmlTags = parseArgs(attributes).join('');

    return self ? `<${name}${htmlTags} />` : `<${name}${htmlTags}>${content}</${name}>`;
  },
};

function typedEntries<T>(obj: Record<string, T>) {
  return Object.entries(obj) as [string, T][];
}

function evalRenderCondition(tag: Tag & TagImplOptions, ctx: Context) {
  const { attributes, liquid } = tag;

  if (attributes && 'if' in attributes) {
    const condition = liquid.evalValueSync(attributes.if, ctx);
    delete attributes.if;
    return condition;
  }

  return true;
}

function parseTemplates(
  tag: Tag & TagImplOptions,
  remainingTokens: TopLevelToken[],
  endToken: string,
): Template[] {
  const { liquid, parser, name: startTagName } = tag;

  let depth = 0;
  const tokens: TopLevelToken[] = [];
  let token = remainingTokens.shift();
  while (token !== undefined) {
    if (token instanceof TagToken) {
      if (token.name === startTagName) depth++;
      else if (token.name === endToken) {
        if (depth === 0) break;
        depth--;
      }
    }

    tokens.push(token);
    token = remainingTokens.shift();
  }

  if (!token) throw new Error(`tag "${startTagName}" not closed`);
  return (liquid.parser ?? parser).parseTokens(tokens);
}

function parseAttributes(attributes: string[]): Record<string, any> {
  const result: Record<string, any> = {};

  attributes.forEach((pair) => {
    const [key, ...value] = pair.split(':').map((s) => s.trim());
    if (key) result[key] = value.join(':') ?? '';
  });

  return result;
}

function parseArgs(attributes: Record<string, any>) {
  const attrArr: string[] = [];

  for (const [key, value] of typedEntries<string | boolean>(attributes)) {
    const evaluated: string | boolean = value;
    if (evaluated === false || evaluated === null) continue;
    else if (evaluated === '') attrArr.push(` ${key}`);
    else attrArr.push(` ${key}="${evaluated}"`);
  }

  return attrArr;
}

function evalAttributes(
  tag: Tag & TagImplOptions,
  ctx: Context,
  attributes: Record<string, string>,
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of typedEntries<string>(attributes))
    result[key] = evalValue<string | boolean>(tag, ctx, value) ?? '';

  return result;
}

function evalValue<T>(tag: Tag & TagImplOptions, ctx: Context, value: string): T | null {
  const { liquid } = tag;
  if (!value) return null;
  return liquid.evalValueSync(value, ctx);
}

function renderTemplates(tag: Tag & TagImplOptions, ctx: Context, templates: Template[]) {
  const { liquid } = tag;
  if (templates && templates.length > 0) return liquid.renderer.renderTemplates(templates, ctx);
  return null;
}

function appendAttributes(attributes: Record<string, any>, additional: Record<string, any>) {
  for (const [key, value] of typedEntries<string>(additional))
    resolveAttribute(attributes, { name: key, value }, additional);
}

function resolveAttribute(
  attributes: Record<string, any>,
  evaluated: { name: string; value: string | boolean },
  attribute: Record<string, any>,
) {
  const { name, value } = evaluated;

  const hasValue = attribute.value !== undefined;
  const exists = attributes[name] !== undefined;
  const genericBool = attributes[name] === true || attributes[name] === false;
  const genericSet = value === '' || !hasValue;

  if (exists && genericBool) attributes[name] = (attributes[name] || value) !== false;
  else if (exists && !genericSet) attributes[name] = `${attributes[name]} ${value}`;
  else attributes[name] = value;
}
