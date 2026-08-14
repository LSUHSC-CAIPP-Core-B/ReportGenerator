//
// Text Styling
//

/**
 * Semantic styles understood by the editor.
 *
 * Boolean values represent toggled styles.
 * String values represent CSS colors.
 */
export type Styles = {
  bold?: boolean;
  strikethrough?: boolean;
  italic?: boolean;
  underlined?: boolean;
  'background-color'?: string | null;
  color?: string | null;
};

/**
 * Maps HTML tags to their semantic style representation.
 *
 * Multiple HTML tags can represent the same semantic style:
 *
 *   <b> and <strong> -> bold
 *   <i> and <em>     -> italic
 *   <s> and <del>    -> strikethrough
 */
export const TAG_STYLE_OVERRIDES: Record<string, Styles> = {
  B: { bold: true },
  DEL: { strikethrough: true },
  EM: { italic: true },
  I: { italic: true },
  MARK: { 'background-color': 'yellow' },
  S: { strikethrough: true },
  STRONG: { bold: true },
  U: { underlined: true },
};

/**
 * Converts a semantic style value into the selector/HTML representation
 * used when generating normalized markup.
 */
type StyleConversionFn<T extends keyof Styles = keyof Styles> = (
  value: NonNullable<Styles[T]>,
) => string;

/**
 * Configuration for each supported style.
 *
 * Tuple contents:
 *
 *   [priority, safe-to-inherit, conversion-function-or-tag]
 */
type StyleOptions = {
  [Key in keyof Styles]: [number, boolean, StyleConversionFn<Key> | string];
};

/**
 * Convert a foreground color into a selector for an inline-colored span.
 */
const FG_COLOR_FN: StyleConversionFn<'color'> = (value) => `span[style="color:${value};"]`;

/**
 * Convert a background color into the corresponding HTML representation.
 *
 * Yellow gets the semantic <mark> element; other colors use an inline
 * background-color span.
 */
const BG_COLOR_FN: StyleConversionFn<'background-color'> = (value) =>
  value === 'yellow' ? 'mark' : `span[style="background-color:${value};"]`;

/**
 * Style priority determines the order in which nested formatting should
 * be normalized.
 */
// biome-ignore assist/source/useSortedKeys: keep priority in order
const STYLE_OPTIONS: StyleOptions = {
  color: [0, true, FG_COLOR_FN],
  'background-color': [1, false, BG_COLOR_FN],
  bold: [2, true, 'b'],
  italic: [3, true, 'i'],
  strikethrough: [4, false, 's'],
  underlined: [5, false, 'u'],
};

/**
 * Extract only the "safe to inherit" setting from STYLE_OPTIONS.
 */
const SAFE_STYLE_INCLUSIONS = Object.fromEntries(
  Object.entries(STYLE_OPTIONS).map(([key, [, safe]]) => [key, safe]),
) as Record<keyof Styles, boolean>;

/**
 * Extract the numeric priority for each style.
 */
const STYLE_PRIORITY = Object.fromEntries(
  Object.entries(STYLE_OPTIONS).map(([key, [priority]]) => [key, priority]),
) as Record<keyof Styles, number>;

/**
 * Styles ordered from highest to lowest normalization priority.
 */
const STYLE_ORDER = Object.entries(STYLE_PRIORITY)
  .sort((a, b) => a[1] - b[1])
  .map(([key]) => key as keyof Styles);

/**
 * Determine whether all active styles are safe to merge/inherit.
 *
 * A style is considered safe when:
 * - it is explicitly marked safe, or
 * - its value is falsy.
 */
export function areStylesSafe(styles: Styles) {
  const keys = Object.keys(styles);

  return keys.every(
    (key) => SAFE_STYLE_INCLUSIONS[key as keyof Styles] || !styles[key as keyof Styles],
  );
}

/**
 * Compare two style objects for exact equality.
 *
 * Both objects are treated as sets of key/value pairs, so missing keys
 * and undefined values are considered equivalent.
 */
export function stylesEqual(a: Styles, b: Styles) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  return [...keys].every((key) => a[key as keyof Styles] === b[key as keyof Styles]);
}

/**
 * Determine whether style set `a` can inherit all explicitly specified
 * values from style set `b`.
 *
 * Any property omitted from `b` is ignored.
 */
function isInheritingStyles(a: Styles, b: Styles) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  return [...keys].every((key) => {
    if (b[key as keyof Styles] === undefined) {
      return true;
    }

    return a[key as keyof Styles] === b[key as keyof Styles];
  });
}
