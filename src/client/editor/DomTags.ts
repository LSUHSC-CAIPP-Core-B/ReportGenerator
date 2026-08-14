import {
  areStylesSafe,
  type Styles,
  stylesEqual,
  TAG_STYLE_OVERRIDES,
} from 'client/editor/Styles.ts';
import { createIdentifier } from 'common/utilities.ts';

/**
 * Delimiters used for template variables.
 *
 * Example:
 *   [[user.name]]
 */
const VARIABLE_START = '[[';
const VARIABLE_STOP = ']]';

/**
 * Valid variable names may contain:
 * - letters
 * - numbers
 * - dots
 * - underscores
 *
 * Examples:
 *   user
 *   user.name
 *   user_name
 *   user.profile.name
 */
const VARIABLE_NAMING = /[A-Za-z\d]+(?:[._][A-Za-z\d]+)*/i;

//
// DOM to Tags
//

/**
 * A tag representing the beginning or end of a semantic style.
 */
export type ElementStyleTag<Type, Style extends keyof Styles = keyof Styles> = {
  style: Style;
  value: Styles[Style];
} & ElementNodeTag<Type>;

/**
 * A tag that contains textual information.
 */
export type ElementTextTag<Type> = GenericTextTagType & ElementNodeTag<Type>;

/**
 * Common metadata attached to every semantic DOM tag.
 */
export type ElementNodeTag<Type> = {
  /**
   * Original DOM node represented by this tag.
   */
  node: Node;

  /**
   * Unique identifier used to distinguish multiple pieces originating
   * from the same DOM node.
   */
  identifier: string;

  /**
   * Styles active at this position in the document.
   */
  styles?: Styles;

  /**
   * Reserved flag for tracking whether a tag needs processing.
   */
  dirty?: boolean;

  /**
   * Discriminated-union type for the tag.
   */
  type: Type extends string ? Type : never;
};

/**
 * Additional metadata used by text-derived tags.
 */
export type GenericTextTagType = {
  /**
   * Actual text represented by this tag.
   */
  text: string;

  /**
   * Whether this tag represents only part of its original DOM text node.
   */
  split: boolean;
};

/**
 * Every semantic tag produced by the DOM parser.
 */
export type ElementTag =
  | ElementStyleTag<'STYLE_START'>
  | ElementStyleTag<'STYLE_STOP'>
  | ElementNodeTag<'LINE_BREAK'>
  | ElementTextTag<'VARIABLE_START'>
  | ElementTextTag<'VARIABLE_STOP'>
  | ElementNodeTag<'VARIABLE'>
  | ElementNodeTag<'VARIABLE_UNWRAP'>
  | ElementTextTag<'WHITESPACE'>
  | ElementTextTag<'TEXT'>;

/**
 * Convert the editor DOM into a linear sequence of ElementTag objects.
 *
 * The DOM is hierarchical, but the normalization algorithm is easier to
 * reason about as a linear stream:
 *
 *   <strong>Hello</strong>
 *
 * becomes roughly:
 *
 *   STYLE_START
 *   TEXT
 *   STYLE_STOP
 *
 * This function also tracks the active styles as the DOM is traversed.
 */
export function createElementTags(element: HTMLElement): ElementTag[] {
  const tags: ElementTag[] = [];

  /**
   * Recursively visit every node in document order.
   *
   * The return value is intentionally unused because Array#push is used
   * for its side effect in a few branches.
   */
  const visit = (node: Node): void => {
    if (isElement(node)) {
      /**
       * <br> is treated as a semantic line break rather than as a normal
       * element with children.
       */
      if (node.tagName === 'BR') {
        // tags.push({
        //   identifier: createIdentifier(),
        //   node,
        //   type: 'LINE_BREAK',
        // });
        return;
      }

      /**
       * <var> elements represent variables.
       *
       * A valid variable stays intact. An invalid <var> is marked for
       * "desolving" so that its contents can be returned to normal text.
       */
      if (node.tagName === 'VAR') {
        if (isVariable(node.innerText)) {
          tags.push({
            identifier: createIdentifier(),
            node,
            type: 'VARIABLE',
          });
          return;
        }

        tags.push({
          identifier: createIdentifier(),
          node,
          type: 'VARIABLE_UNWRAP',
        });
      }

      /**
       * Look up any semantic style represented by this HTML tag.
       */
      const override = TAG_STYLE_OVERRIDES[node.tagName];

      /**
       * Turn each style property into a style tag.
       */
      const styles = Object.keys(override ?? {}).map((style) => ({
        node,
        style: style as keyof Styles,
        value: override![style as keyof Styles],
      }));

      /**
       * Emit STYLE_START tags before visiting the children.
       *
       * This is equivalent to opening a formatting scope.
       */
      if (override) {
        tags.push(
          ...styles.map((style) => ({
            ...style,
            identifier: createIdentifier(),
            type: 'STYLE_START' as const,
          })),
        );
      }

      /**
       * Visit child nodes in document order.
       */
      node.childNodes.forEach(visit);

      /**
       * Emit STYLE_STOP tags after visiting the children.
       *
       * Reverse the style order so nested styles are closed in the correct
       * order.
       */
      if (override) {
        tags.push(
          ...styles.reverse().map((style) => ({
            ...style,
            identifier: createIdentifier(),
            type: 'STYLE_STOP' as const,
          })),
        );
      }
    } else {
      /**
       * Text nodes are split into semantic pieces so that variables can be
       * recognized even when their delimiters span multiple DOM nodes.
       */
      const text = node.nodeValue ?? '';

      /**
       * A lone newline is treated as a line break.
       */
      if (text === '\n') {
        tags.push({
          identifier: createIdentifier(),
          node,
          type: 'LINE_BREAK',
        });
        return;
      }

      /**
       * Whitespace-only nodes are kept separate because whitespace can
       * sometimes be moved between formatting elements without affecting
       * the visible content.
       */
      if (text.trim() === '') {
        tags.push({
          identifier: createIdentifier(),
          node,
          split: false,
          text,
          type: 'WHITESPACE',
        });
        return;
      }

      /**
       * First split around complete variables, then split around the
       * individual variable delimiters.
       *
       * For example:
       *
       *   "Hello [[name]]!"
       *
       * becomes:
       *
       *   "Hello "
       *   "[[name]]"
       *   "!"
       *
       * and then the variable itself can be split into:
       *
       *   "[["
       *   "name"
       *   "]]"
       */
      text
        .split(VARIABLE_SPLITTER)
        .flatMap((part) => part.split(VARIABLE_KEY_SPLITTER))
        .forEach((part) => {
          /**
           * `split` tells us whether this tag represents only part of the
           * original DOM text node.
           */
          const split = part !== node.nodeValue;

          if (part === VARIABLE_START) {
            tags.push({
              identifier: createIdentifier(),
              node,
              split,
              text: part,
              type: 'VARIABLE_START',
            });
          } else if (part === VARIABLE_STOP) {
            tags.push({
              identifier: createIdentifier(),
              node,
              split,
              text: part,
              type: 'VARIABLE_STOP',
            });
          } else {
            tags.push({
              identifier: createIdentifier(),
              node,
              split,
              text: part,
              type: 'TEXT',
            });
          }
        });
    }
  };

  /**
   * Convert the entire DOM subtree into tags.
   */
  visit(element);

  /**
   * Track the currently active styles while walking through the generated
   * tag stream.
   */
  const styles: Styles[] = [];

  for (const tag of tags) {
    const activeStyles = styles.at(-1) ?? {};

    if (tag.type === 'STYLE_START') {
      /**
       * Opening a style adds it to the active style stack.
       */
      const { style, value } = tag;
      styles.push({ ...activeStyles, [style]: value });
    } else if (tag.type === 'STYLE_STOP') {
      /**
       * Closing a style removes it from the active stack, but only when
       * the style being closed matches the active style.
       */
      const { style, value } = tag;
      if (activeStyles[style] === value) styles.pop();
    } else {
      /**
       * Normal tags receive a snapshot of the styles active at their
       * location in the document.
       */
      tag.styles = activeStyles;
    }
  }

  return tags;
}

// function domToTags(root: Element): ElementTag[] {
//   // traversal
// }

// function nodeToTags(node: Node): ElementTag[] {
//   // individual node conversion
// }

// function textToTags(node: Text): ElementTag[] {
//   // text/variable parsing
// }

// function applyStyles(tags: ElementTag[]): void {
//   // style stack
// }

/**
 * Group compatible tags into blocks that can safely be normalized together.
 *
 * The goal is to avoid unnecessarily splitting equivalent content while
 * ensuring that incompatible formatting remains separate.
 */
export function groupSimilarElementTags(tags: ElementTag[]): ElementTag[][] {
  const groups: ElementTag[][] = [];

  /**
   * Create a new group and immediately register it.
   */
  const startGroup = () => {
    const group: ElementTag[] = [];

    groups.push(group);

    return group;
  };

  /**
   * Determine whether an element is incompatible with the current group.
   *
   * Returning true causes the caller to start a new group.
   */
  const shouldSplit = (group: ElementTag[], element: ElementTag) => {
    /**
     * STYLE_START elements may follow whitespace, but only when both the
     * existing styles and the incoming style are safe to merge.
     *
     * If the group already contains a non-whitespace styled element,
     * a new style must begin a separate group.
     */
    if (element.type === 'STYLE_START') {
      const styled = group.filter(hasStyles);
      const whitespace = styled.find(isWhitespace);

      const $style = {
        [element.style]: element.value,
      };

      return (
        styled.some(notWhitespace) ||
        (whitespace && (!areStylesSafe(whitespace.styles!) || !areStylesSafe($style)))
      );
    }

    /**
     * For another styled element, compare its styles against the first
     * styled element already present in the group.
     *
     * LINE_BREAK is deliberately excluded because it should not force
     * surrounding formatting to split.
     */
    if (group.length && element.styles) {
      const first = group.filter(notWhitespace).find(hasStyles)?.styles;
      const second = element.styles;

      if (first && element.type !== 'LINE_BREAK') {
        /**
         * Unsafe styles or an already-populated group require stricter
         * equality checks before the elements can share a group.
         */
        if (!areStylesSafe(first) || !areStylesSafe(second) || !group.every(isWhitespace)) {
          return !stylesEqual(first, second) && (notWhitespace(element) || !areStylesSafe(first));
        }
      }
    }

    return false;
  };

  /**
   * Process each tag in document order and place it into a compatible group.
   */
  for (const element of tags) {
    let previous = groups.at(-1) ?? startGroup();

    if (shouldSplit(previous, element)) {
      previous = startGroup();
    }

    previous.push(element);
  }

  return groups;
}

//
// Helper Functions
//

/**
 * Escape the variable delimiters so they can safely be embedded in
 * dynamically-created regular expressions.
 */
const ESCAPED_START_VARIABLE = RegExp.escape(VARIABLE_START);
const ESCAPED_STOP_VARIABLE = RegExp.escape(VARIABLE_STOP);

/**
 * Split immediately before or after a variable delimiter.
 *
 * Example:
 *
 *   "hello[[name]]"
 *
 * becomes:
 *
 *   "hello", "[[", "name", "]]"
 */
const VARIABLE_KEY_SPLITTER = new RegExp(
  `(?=${ESCAPED_START_VARIABLE}|${ESCAPED_STOP_VARIABLE})` +
    `|(?<=${ESCAPED_START_VARIABLE}|${ESCAPED_STOP_VARIABLE})`,
  'g',
);

/**
 * Match a complete variable.
 *
 * Examples:
 *
 *   [[name]]
 *   [[user.name]]
 *   [[user_profile.name]]
 */
const VARIABLE_REGEX = new RegExp(
  `${ESCAPED_START_VARIABLE}${VARIABLE_NAMING.source}${ESCAPED_STOP_VARIABLE}`,
  'g',
);

/**
 * Match an exact variable.
 */
const VARIABLE_EXACT_REGEX = new RegExp(
  `^${ESCAPED_START_VARIABLE}${VARIABLE_NAMING.source}${ESCAPED_STOP_VARIABLE}$`,
);

/**
 * Split text immediately before and after complete variables.
 */
const VARIABLE_SPLITTER = new RegExp(
  `(?=${VARIABLE_REGEX.source})|(?<=${VARIABLE_REGEX.source})`,
  'g',
);

/**
 * Determine whether the entire supplied string is one valid variable.
 */
export function isVariable(value: string) {
  return VARIABLE_EXACT_REGEX.test(value);
}

/**
 * Determine whether a tag represents meaningful text content.
 *
 * Formatting markers, whitespace, line breaks, and invalid variables are
 * excluded.
 */
export function isTextTag(tag: ElementTag) {
  return (
    notSpecialTag(tag) &&
    !isVariableTag(tag) &&
    tag.type !== 'VARIABLE_UNWRAP' &&
    tag.type !== 'LINE_BREAK'
  );
}

/**
 * Determine whether a tag is neither whitespace nor a formatting/variable
 * marker.
 */
export function notSpecialTag(tag: ElementTag) {
  return notWhitespace(tag) && !isStyleTag(tag);
}

/**
 * Determine whether a tag is one of the two variable delimiters.
 */
export function isVariableCheckTag(tag: ElementTag) {
  return tag.type === 'VARIABLE_START' || tag.type === 'VARIABLE_STOP';
}

/**
 * Determine whether a tag represents an already-valid <var> element.
 */
export function isVariableTag(tag: ElementTag) {
  return tag.type === 'VARIABLE';
}

/**
 * Determine whether a tag represents an already-valid <var> element,
 * and should be unwrapped
 */
export function isVariableUnwrapTag(tag: ElementTag) {
  return tag.type === 'VARIABLE_UNWRAP';
}

/**
 * Determine whether a tag opens or closes a style.
 */
export function isStyleTag(tag: ElementTag) {
  return tag.type === 'STYLE_START' || tag.type === 'STYLE_STOP';
}

/**
 * Determine whether a tag has active style information attached to it.
 */
export function hasStyles(tag: ElementTag) {
  return tag.styles !== undefined;
}

/**
 * Determine whether a tag is not whitespace.
 */
export function notWhitespace(tag: ElementTag) {
  return tag.type !== 'WHITESPACE';
}

/**
 * Determine whether a tag represents a line break.
 */
export function isLineBreak(tag: ElementTag) {
  return tag.type === 'LINE_BREAK';
}

/**
 * Determine whether a tag represents whitespace.
 */
export function isWhitespace(tag: ElementTag) {
  return tag.type === 'WHITESPACE';
}

/**
 * Type guard for DOM elements.
 */
export function isElement(node: any): node is HTMLElement {
  return typeof node === 'object' && 'nodeType' in node && node.nodeType === Node.ELEMENT_NODE;
}
