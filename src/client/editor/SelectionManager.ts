import { e$ } from 'client/utils.ts';

type Styles = {
  bold?: boolean;
  strikethrough?: boolean;
  italic?: boolean;
  underlined?: boolean;
  'background-color'?: string | null;
  color?: string | null;
};

type TextRun = {
  text: string;
  styles: Styles;
  break?: true;
  variable?: true;
};

type StyleNode<K extends keyof Styles = keyof Styles> = {
  type: 'style';
  style: K;
  value: NonNullable<Styles[K]>;
  children: TreeNode[];
};

type TreeNode = { type: 'text'; text: string } | { type: 'variable'; text: string } | StyleNode;

type StyleOperation = {
  start: Node;
  startOffset: number;
  end: Node;
  endOffset: number;
  styles: Partial<Styles>;
};

const TAG_STYLE_OVERRIDES: Record<string, Styles> = {
  B: { bold: true },
  DEL: { strikethrough: true },
  DIV: {},
  EM: { italic: true },
  I: { italic: true },
  // INS: { underlined: true },
  MARK: { 'background-color': 'yellow' },
  S: { strikethrough: true },
  STRONG: { bold: true },
  U: { underlined: true },
};

type StyleConversionFn<T extends keyof Styles = keyof Styles> = (
  value: NonNullable<Styles[T]>,
) => string;

type StyleOptions = { [Key in keyof Styles]: [number, boolean, StyleConversionFn<Key> | string] };

const FG_COLOR_FN: StyleConversionFn<'color'> = (value) => `span[style="color:${value};"]`;
const BG_COLOR_FN: StyleConversionFn<'background-color'> = (value) =>
  value === 'yellow' ? 'mark' : `span[style="background-color:${value};"]`;

// biome-ignore assist/source/useSortedKeys: keep priority in order
const STYLE_OPTIONS: StyleOptions = {
  /* STYLE_TYPE: [LOOKUP PRIORITY, MERGE SPACE FROM PREV, CONVERSION TO EMMET] */
  color: [0, true, FG_COLOR_FN],
  'background-color': [1, false, BG_COLOR_FN],
  bold: [2, true, 'b'],
  italic: [3, true, 'i'],
  strikethrough: [4, false, 's'],
  underlined: [5, false, 'u'],
};

const SAFE_STYLE_INCLUSIONS = Object.fromEntries(
  Object.entries(STYLE_OPTIONS).map(([k, [, safe]]) => [k, safe]),
) as Record<keyof Styles, boolean>;

const STYLE_PRIORITY = Object.fromEntries(
  Object.entries(STYLE_OPTIONS).map(([k, [priority]]) => [k, priority]),
) as Record<keyof Styles, number>;

const STYLE_ORDER = Object.entries(STYLE_PRIORITY)
  .sort((a, b) => a[1] - b[1])
  .map(([k]) => k as keyof Styles);

const VARIABLE_REGEX = /\[\[[A-Za-z\d_]+\]\]/g;
const VARIABLE_SPLITTER = new RegExp(
  `(?=${VARIABLE_REGEX.source})|(?<=${VARIABLE_REGEX.source})`,
  'g',
);

interface EditorState {
  html: string;
  selection?: never;
}

export class SelectionEditor {
  private undoStack: EditorState[] = [];
  private redoStack: EditorState[] = [];
  private readonly editor: HTMLElement;

  constructor(elementOrId: string);
  constructor(elementOrId: HTMLElement);
  constructor(elementOrId: string | HTMLElement) {
    this.editor =
      typeof elementOrId === 'string' ? document.querySelector(elementOrId)! : elementOrId;
    if (!this.editor) throw new Error(`Editor doens't exist or wasn't found: ${elementOrId}`);

    document.addEventListener('selectionchange', () => this.onSelection());
    this.editor.addEventListener('keydown', (event) => this.onKeyPress(event));
  }

  private onSelection = () => {
    const selection = window.getSelection();

    this.editor.querySelectorAll('.active').forEach((el) => {
      el.classList.remove('active');
    });

    if (!selection?.rangeCount) return;

    let node = selection.anchorNode;

    // If the caret is in a text node, get its parent element.
    if (node?.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    const target = (node as HTMLElement)?.closest('var');
    if (target) target.classList.add('active');
  };

  private onKeyPress = (event: KeyboardEvent) => {
    // console.log(event.metaKey, event.key);

    if (!event.metaKey) {
      const selection = window.getSelection();

      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let node: Node = range.startContainer;

        // If the caret is inside a text node, use its parent element
        if (node.nodeType === Node.TEXT_NODE) {
          node = node.parentNode!;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          if ((node as Element).tagName.toLowerCase() === 'var') {
            if (!node.nextSibling) {
              const target = document.createTextNode('\n');
              node.parentElement!.appendChild(target);
            }

            range.selectNode(node.nextSibling!);
            range.collapse(true);

            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }
      return;
    } else if (event.key === 'r') return;
    else if (event.key.length === 1) event.preventDefault();

    let styles!: Styles;
    const selection = this.getSelectionNodes();

    const hasStyle = (tag: string) => {
      const element = selection?.start.parentElement?.closest(tag);
      return (selection && element?.contains(selection.end)) || false;
    };

    // biome-ignore-start lint/suspicious/noFallthroughSwitchClause: update styles
    switch (event.key) {
      case 'b':
        styles ??= { bold: !hasStyle('b,strong') };
      /* falls through */
      case 'i':
        styles ??= { italic: !hasStyle('i,em') };
      /* falls through */
      case 'u':
        styles ??= { underlined: !hasStyle('u') };
      /* falls through */
      case 'k':
        styles ??= { strikethrough: !hasStyle('s,del') };
      /* falls through */
      case '/': {
        styles ??= {
          'background-color': null,
          bold: false,
          color: null,
          italic: false,
          strikethrough: false,
          underlined: false,
        };

        if (!selection) break;

        const operation: StyleOperation = Object.assign(selection, { styles });
        const emmet = this.getEmmet(this.editor, Object.freeze(operation));
        console.log(emmet);
        this.editor.replaceChildren(...e$(`p.doc>(${emmet ?? ''})`).childNodes);

        break;
      }
      case 'a': {
        const selection = window.getSelection();
        if (!selection) break;

        const nodes = this.getFirstAndLastTextNodes(this.editor);
        if (!nodes) break;

        const range = document.createRange();

        // Beginning of the first text node
        range.setStart(nodes.first, 0);

        // End of the last text node
        range.setEnd(nodes.last, nodes.last.textContent?.length ?? 0);

        selection.removeAllRanges();
        selection.addRange(range);

        break;
      }
    }
    // biome-ignore-end lint/suspicious/noFallthroughSwitchClause: update styles
  };

  private getFirstAndLastTextNodes(root: Node) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });

    const first = walker.nextNode();
    if (!first) return null;

    let last = first;
    while (walker.nextNode()) {
      last = walker.currentNode;
    }

    return { first, last };
  }

  private getSelectionNodes() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const editor = document.getElementById('editor');

    const range = selection.getRangeAt(0);
    const {
      commonAncestorContainer: common,
      startContainer: start,
      endContainer: end,
      startOffset,
      endOffset,
    } = range;

    if (!editor?.contains(common)) return;

    return { common, end, endOffset, start, startOffset };
  }

  private getEmmet(parent: Node, operation?: StyleOperation) {
    const runs = this.flatten(parent, operation);
    const merged = this.mergeRuns(runs);
    const tree = this.buildTree(merged);
    return this.toEmmetTree(tree);
  }

  private flatten(root: Node, operation?: StyleOperation) {
    const runs: TextRun[] = [];

    let applyingOperation = false;

    const visit = (node: Node, inherited: Styles) => {
      if (operation?.start === node) applyingOperation = true;

      const styles = { ...inherited };

      const styleOverrides = TAG_STYLE_OVERRIDES[node.nodeName.toUpperCase()];
      if (styleOverrides) Object.assign(styles, styleOverrides);
      // if (applyingOperation) Object.assign(styles, operation!.styles);

      switch (node.nodeType) {
        case Node.ELEMENT_NODE: {
          // TODO:
          // Read inline CSS here if desired.
          // Example:
          //
          const el = node as HTMLElement;
          // if (el.style.color) styles.color = el.style.color;

          if (el instanceof HTMLBRElement) {
            // delete styles.variable;
            runs.push({ break: true, styles, text: '\n' });
          }

          node.childNodes.forEach((child) => {
            visit(child, styles);
          });

          break;
        }

        case Node.TEXT_NODE: {
          const text = node.textContent;
          if (!text?.length) break;

          const length = text.length;
          const texts = text.split(VARIABLE_SPLITTER);

          if (!operation) {
            texts.forEach((text) => {
              if (text.match(VARIABLE_REGEX)) {
                runs.push({ styles, text, variable: true });
              } else runs.push({ styles, text });
            });
            break;
          }

          const styled = Object.assign({}, styles, operation.styles);

          let { start: sNode, startOffset: start, end: eNode, endOffset: end } = operation;
          start = Math.min(sNode === node ? start : 0, length);
          end = Math.min(eNode === node ? end : length, length);

          let size = 0;

          texts.filter(Boolean).forEach((text) => {
            const variable = text.match(VARIABLE_REGEX) != null;

            if (variable) {
              if (!applyingOperation) runs.push({ styles, text, variable });
              // We would have to cut the variable in half... no bueno
              else if (size < start && start < size + text.length)
                runs.push({ styles: styled, text, variable });
              // We selected the variable on the other half... no bueno
              else if (size < end && size - text.length < end)
                runs.push({ styles: styled, text, variable });
              else runs.push({ styles, text, variable });
            } else {
              // Not a variable, let's split based on format
              const iS = applyingOperation ? Math.max(start - size, 0) : text.length;
              const iE = Math.min(end - size, text.length);

              const before = text.slice(0, iS);
              const middle = text.slice(iS, iE);
              const after = text.slice(iE);

              if (before) runs.push({ styles, text: before });
              if (middle) runs.push({ styles: styled, text: middle });
              if (after) runs.push({ styles, text: after });
            }

            size += text.length;
          });

          break;
        }
      }

      if (operation?.end === node) applyingOperation = false;
    };

    visit(root, {});

    return runs;
  }

  private mergeRuns(runs: TextRun[]): TextRun[] {
    if (runs.length === 0) return [];

    const merged: TextRun[] = [];

    for (const current of runs) {
      const previous = merged.at(-1);

      if (previous && !previous.variable && !current.variable) {
        if (current.break) {
          previous.text += current.text;
          // previous.styles = current.styles;
          if (previous.break) delete previous.break;
          continue;
        }

        // New lines don't keep formatting
        const content = current.text.replaceAll(/(?=[^ ])\s/gi, '');
        const prevContent = previous.text.replaceAll(/(?=[^ ])\s/gi, '');

        // Check if just whitespace
        if (!current.break && content.length && !content.trim()) {
          // current text is empty
          if (this.areStylesSafe(previous.styles)) {
            previous.text += current.text;
            continue;
          }
        } else if (!previous.break && prevContent.length && !prevContent.trim()) {
          // prev text is empty
          if (this.areStylesSafe(previous.styles)) {
            previous.styles = current.styles;
            previous.text += current.text;
            continue;
          }
        } else if (previous.break || this.stylesEqual(previous.styles, current.styles)) {
          previous.text += current.text;
          previous.styles = current.styles;
          delete previous.break;
          continue;
        }
      }

      if (current.text === '\n') current.break = true;

      merged.push({
        break: current.break,
        styles: { ...current.styles },
        text: current.text,
        variable: current.variable,
      });
    }

    return merged;
  }

  private areStylesSafe(styles: Styles) {
    const keys = Object.keys(styles);
    return keys.every(
      (key) => SAFE_STYLE_INCLUSIONS[key as keyof Styles] || !styles[key as keyof Styles],
    );
  }

  private stylesEqual(a: Styles, b: Styles) {
    // if (a.variable || b.variable) return false;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => a[key as keyof Styles] === b[key as keyof Styles]);
  }

  private isInheritingStyles(a: Styles, b: Styles) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => {
      if (b[key as keyof Styles] === undefined) return true;
      return a[key as keyof Styles] === b[key as keyof Styles];
    });
  }

  private buildTree(runs: TextRun[]): TreeNode[] {
    const root: { children: TreeNode[] } = {
      children: [],
    };

    const stack: {
      style?: keyof Styles;
      value?: unknown;
      children: TreeNode[];
    }[] = [root];

    const styles: Styles[] = [];

    for (const run of runs) {
      let previous = styles.at(-1);

      while (previous && !this.isInheritingStyles(run.styles, previous)) {
        styles.pop();
        stack.pop();
        previous = styles.at(-1);
      }

      // Open new styles.
      for (const key of STYLE_ORDER) {
        if (previous && previous[key] === run.styles[key]) continue;

        const value = run.styles[key];
        if (value == null) continue;

        const node: TreeNode = {
          children: [],
          style: key,
          type: 'style',
          value,
        };

        stack.at(-1)!.children.push(node);

        stack.push(node);
        styles.push({ ...styles.at(-1), [key]: run.styles[key] });
        previous = styles.at(-1);
      }

      stack.at(-1)!.children.push({
        text: run.text.replaceAll(/(?=\\|\{|\})/gi, '\\'),
        type: run.variable ? 'variable' : 'text',
      });
    }

    return root.children;
  }

  private toEmmetTree(tree: TreeNode[]) {
    const root: string[] = [];

    for (const element of tree) {
      if (element.type === 'style') {
        if (element.value === false) {
          root.push(this.toEmmetTree(element.children));
        } else
          root.push(`(${this.resolveEmmetElement(element)}>${this.toEmmetTree(element.children)})`);
      } else if (element.type === 'variable') {
        root.push(`(var>{${element.text}})`);
      } else {
        element.text.split(/\n/gi).forEach((v, i, a) => {
          if (v !== '') root.push(`{${v}}`);
          if (a.length - 1 !== i) root.push('br');
        });
      }
    }

    return root.join('+');
  }

  resolveEmmetElement<Style extends keyof Styles>(element: {
    type: 'style';
    style: Style;
    value: NonNullable<Styles[Style]>;
    children: TreeNode[];
  }) {
    const resolver = STYLE_OPTIONS[element.style]![2];
    return typeof resolver === 'function' ? resolver(element.value) : resolver;
  }
}
