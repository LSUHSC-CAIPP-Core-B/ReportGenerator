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

type VariableValues = Record<string, string | null | undefined>;

type EditorState = {
  html: string;
};

const TAG_STYLE_OVERRIDES: Record<string, Styles> = {
  B: { bold: true },
  DEL: { strikethrough: true },
  DIV: {},
  EM: { italic: true },
  I: { italic: true },
  MARK: { 'background-color': 'yellow' },
  S: { strikethrough: true },
  STRONG: { bold: true },
  U: { underlined: true },
};

type StyleConversionFn<T extends keyof Styles = keyof Styles> = (
  value: NonNullable<Styles[T]>,
) => string;

type StyleOptions = {
  [Key in keyof Styles]: [number, boolean, StyleConversionFn<Key> | string];
};

const FG_COLOR_FN: StyleConversionFn<'color'> = (value) => `span[style="color:${value};"]`;

const BG_COLOR_FN: StyleConversionFn<'background-color'> = (value) =>
  value === 'yellow' ? 'mark' : `span[style="background-color:${value};"]`;

// biome-ignore assist/source/useSortedKeys: keep priority in order
const STYLE_OPTIONS: StyleOptions = {
  color: [0, true, FG_COLOR_FN],
  'background-color': [1, false, BG_COLOR_FN],
  bold: [2, true, 'b'],
  italic: [3, true, 'i'],
  strikethrough: [4, false, 's'],
  underlined: [5, false, 'u'],
};

const SAFE_STYLE_INCLUSIONS = Object.fromEntries(
  Object.entries(STYLE_OPTIONS).map(([key, [, safe]]) => [key, safe]),
) as Record<keyof Styles, boolean>;

const STYLE_PRIORITY = Object.fromEntries(
  Object.entries(STYLE_OPTIONS).map(([key, [priority]]) => [key, priority]),
) as Record<keyof Styles, number>;

const STYLE_ORDER = Object.entries(STYLE_PRIORITY)
  .sort((a, b) => a[1] - b[1])
  .map(([key]) => key as keyof Styles);

const VARIABLE_REGEX = /\[\[(?:[A-Za-z\d]+(?:[._][A-Za-z\d]+)*)+\]\]/g;

const VARIABLE_SPLITTER = new RegExp(
  `(?=${VARIABLE_REGEX.source})|(?<=${VARIABLE_REGEX.source})`,
  'g',
);

const isLineBreak = (node: Node | null): boolean =>
  node?.nodeType === Node.TEXT_NODE && node.nodeValue === '\n';

const isEditableTextNode = (node: Node | null): boolean =>
  node?.nodeType === Node.TEXT_NODE && !isLineBreak(node);

const desync = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export class DocumentEditor {
  private undoStack: EditorState[] = [];
  private redoStack: EditorState[] = [];
  private readonly editor: HTMLElement;

  constructor(elementOrId: string);
  constructor(elementOrId: HTMLElement);
  constructor(elementOrId: string | HTMLElement) {
    this.editor =
      typeof elementOrId === 'string'
        ? document.querySelector<HTMLElement>(elementOrId)!
        : elementOrId;

    if (!this.editor) {
      throw new Error(`Editor doesn't exist or wasn't found: ${elementOrId}`);
    }

    document.addEventListener('selectionchange', this.onSelection);
    this.editor.addEventListener('keydown', this.onKeyPress);
    this.refreshEditor();
  }

  /**
   * Clean up event listeners when the editor is destroyed.
   */
  destroy() {
    document.removeEventListener('selectionchange', this.onSelection);
    this.editor.removeEventListener('keydown', this.onKeyPress);
  }

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  private onSelection = () => {
    const selection = window.getSelection();

    this.editor.querySelectorAll('.active').forEach((el) => {
      el.classList.remove('active');
    });

    if (!selection?.rangeCount) return;
    let node = selection.anchorNode;

    if (node?.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    if (!(node instanceof Element)) return;
    const target = node.closest('var');

    if (target && this.editor.contains(target)) {
      target.classList.add('active');
    }
  };

  // ---------------------------------------------------------------------------
  // Keyboard handling
  // ---------------------------------------------------------------------------

  private onKeyPress = async (event: KeyboardEvent) => {
    if (!event.metaKey && !event.ctrlKey) {
      this.handleNormalKey(event);
      return;
    }

    this.handleShortcut(event);

    /*
     * Let the browser perform the normal editing operation first.
     * This is important because we need to inspect the resulting text
     * when the user is typing inside a variable.
     */
    await desync();

    this.cleanupActiveVariables();
  };

  private handleNormalKey(event: KeyboardEvent) {
    const selection = window.getSelection();

    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);

    let node: Node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode!;
    }

    // /*
    //  * Prevent the caret from getting trapped inside a <var>.
    //  *
    //  * Once a variable is resolved/invalidated, the variable gets converted
    //  * back into normal text.
    //  */
    // if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName.toLowerCase() === 'var') {
    //   this.moveCaretOutsideVariable(node as HTMLElement);
    // }
  }

  private handleShortcut(event: KeyboardEvent) {
    if (event.key.toLowerCase() === 'r') {
      return;
    }

    /*
     * Don't let Cmd/Ctrl + arbitrary characters modify the document.
     */
    if (event.key.length === 1) {
      event.preventDefault();
    }

    let styles: Styles | undefined;

    const selection = this.getSelectionNodes();

    const hasStyle = (tag: string) => {
      const element = selection?.start.parentElement?.closest(tag);

      return !!selection && !!element && element.contains(selection.end);
    };

    // biome-ignore-start lint/suspicious/noFallthroughSwitchClause: update styles
    switch (event.key.toLowerCase()) {
      case 'b':
        styles ??= {
          bold: !hasStyle('b,strong'),
        };
      /* falls through */

      case 'i':
        styles ??= {
          italic: !hasStyle('i,em'),
        };
      /* falls through */

      case 'u':
        styles ??= {
          underlined: !hasStyle('u'),
        };
      /* falls through */

      case 'k':
        styles ??= {
          strikethrough: !hasStyle('s,del'),
        };
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

        const operation: StyleOperation = {
          ...selection,
          styles,
        };

        const emmet = this.getEmmet(this.editor, Object.freeze(operation));

        this.saveUndoState();

        this.editor.replaceChildren(...e$(`p.doc>(${emmet ?? ''}`).childNodes);

        break;
      }

      case 'a': {
        const selection = window.getSelection();
        if (!selection) break;

        const nodes = this.getFirstAndLastTextNodes(this.editor);
        if (!nodes) break;

        const range = document.createRange();

        range.setStart(nodes.first, 0);
        range.setEnd(nodes.last, nodes.last.textContent?.length ?? 0);

        selection.removeAllRanges();
        selection.addRange(range);

        break;
      }
    }
    // biome-ignore-end lint/suspicious/noFallthroughSwitchClause: update styles
  }

  private refreshEditor() {
    const emmet = this.getEmmet(this.editor);
    this.editor.replaceChildren(...e$(`p.doc>(${emmet ?? ''}`).childNodes);
  }

  // ---------------------------------------------------------------------------
  // Variables
  // ---------------------------------------------------------------------------

  /**
   * Resolve all variables in the editor.
   *
   * Example:
   *
   * resolveVariables({
   *   firstName: 'John',
   *   company: 'Acme',
   * });
   *
   * [[firstName]] -> John
   * [[company]]  -> Acme
   *
   * If removeUnresolved is true:
   *
   * [[unknown]] -> ''
   */
  resolveVariables(values: VariableValues, removeUnresolved = false) {
    this.saveUndoState();

    const variables = this.getVariables();

    for (const variable of variables) {
      const raw = variable.textContent ?? '';
      const name = this.getVariableName(raw);

      if (!name) continue;

      const value = values[name];

      if (value != null) {
        this.replaceVariable(variable, value);
      } else if (removeUnresolved) {
        this.removeVariable(variable);
      }
    }

    this.cleanupEditor();
  }

  /**
   * Resolve a single variable.
   */
  resolveVariable(name: string, value: string | null | undefined) {
    const variables = this.getVariables();

    for (const variable of variables) {
      const variableName = this.getVariableName(variable.textContent ?? '');

      if (variableName !== name) continue;

      if (value == null) {
        this.removeVariable(variable);
      } else {
        this.replaceVariable(variable, value);
      }
    }

    this.cleanupEditor();
  }

  /**
   * Remove every variable from the document.
   *
   * [[foo]] -> ''
   */
  removeVariables() {
    this.saveUndoState();

    for (const variable of this.getVariables()) {
      this.removeVariable(variable);
    }

    this.cleanupEditor();
  }

  /**
   * Returns all variable names currently present.
   *
   * Example:
   *
   * [[firstName]], [[company]], [[firstName]]
   *
   * => ['firstName', 'company']
   */
  getVariableNames(): string[] {
    const names = new Set<string>();

    for (const variable of this.getVariables()) {
      const name = this.getVariableName(variable.textContent ?? '');

      if (name) {
        names.add(name);
      }
    }

    return [...names];
  }

  /**
   * Returns all <var> elements in document order.
   */
  private getVariables(): HTMLElement[] {
    return [...this.editor.querySelectorAll<HTMLElement>('var')];
  }

  private getVariableName(text: string): string | null {
    const match = text.match(/^\[\[((?:[A-Za-z\d]+(?:[._][A-Za-z\d]+)*)+)\]\]$/);

    return match?.[1] ?? null;
  }

  /**
   * Replace a variable while keeping the variable's parent styles intact.
   */
  private replaceVariable(variable: HTMLElement, value: string) {
    const text = document.createTextNode(value);

    variable.replaceWith(text);
  }

  /**
   * Remove a variable completely.
   */
  private removeVariable(variable: HTMLElement) {
    variable.remove();
  }

  /**
   * Variables that have been edited by the user may no longer contain
   * a valid [[foo]] expression.
   *
   * Convert invalid <var> elements back into ordinary text.
   */
  private cleanupActiveVariables() {
    const variables = this.getVariables();

    for (const variable of variables) {
      if (
        variable.classList.contains('active') &&
        !this.getVariableName(variable.textContent ?? '')
      ) {
        this.unwrapVariable(variable);
      }
    }
  }

  /**
   * Convert <var>some text</var> into normal text while merging adjacent
   * text nodes.
   */
  private unwrapVariable(variable: HTMLElement) {
    const parent = variable.parentNode;

    if (!parent) return;

    const text = document.createTextNode(variable.textContent ?? '');

    parent.replaceChild(text, variable);

    this.mergeAdjacentTextNodes(text);
  }

  private mergeAdjacentTextNodes(node: Text) {
    const previous = node.previousSibling;
    const next = node.nextSibling;

    if (previous && isEditableTextNode(previous)) {
      const previousText = previous.nodeValue ?? '';
      const offset = previousText.length;

      node.nodeValue = previousText + (node.nodeValue ?? '');
      previous.remove();

      this.setCaret(node, offset);
    }

    if (next && isEditableTextNode(next)) {
      node.nodeValue = (node.nodeValue ?? '') + (next.nodeValue ?? '');

      next.remove();
    }
  }

  private moveCaretOutsideVariable(variable: HTMLElement) {
    const selection = window.getSelection();

    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);

    if (!variable.contains(range.startContainer)) return;

    const parent = variable.parentNode;

    if (!parent) return;

    let next = variable.nextSibling;

    if (!next) {
      next = document.createTextNode('');
      parent.appendChild(next);
    }

    const caret = document.createRange();

    if (next.nodeType === Node.TEXT_NODE) {
      caret.setStart(next, 0);
      caret.collapse(true);
    } else {
      caret.setStartBefore(next);
      caret.collapse(true);
    }

    selection.removeAllRanges();
    selection.addRange(caret);
  }

  private setCaret(node: Text, offset: number) {
    const selection = window.getSelection();

    if (!selection) return;

    const range = document.createRange();

    range.setStart(node, Math.min(offset, node.length));

    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);
  }

  /**
   * Remove empty text nodes and merge adjacent text nodes.
   */
  private cleanupEditor() {
    const walker = document.createTreeWalker(this.editor, NodeFilter.SHOW_TEXT);

    const textNodes: Text[] = [];

    let current: Node | null;

    while (true) {
      current = walker.nextNode();
      if (current == null) break;
      textNodes.push(current as Text);
    }

    for (const node of textNodes) {
      if (!node.parentNode) continue;

      if (!node.nodeValue) {
        node.remove();
        continue;
      }

      const previous = node.previousSibling;

      if (previous && isEditableTextNode(previous)) {
        previous.nodeValue = (previous.nodeValue ?? '') + (node.nodeValue ?? '');

        node.remove();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Selection helpers
  // ---------------------------------------------------------------------------

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

    return {
      first: first as Text,
      last: last as Text,
    };
  }

  private getSelectionNodes() {
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);

    const {
      commonAncestorContainer: common,
      startContainer: start,
      endContainer: end,
      startOffset,
      endOffset,
    } = range;

    if (!this.editor.contains(common)) return;

    return {
      common,
      end,
      endOffset,
      start,
      startOffset,
    };
  }

  // ---------------------------------------------------------------------------
  // Undo
  // ---------------------------------------------------------------------------

  private saveUndoState() {
    this.undoStack.push({
      html: this.editor.innerHTML,
    });

    this.redoStack.length = 0;
  }

  undo() {
    const previous = this.undoStack.pop();

    if (!previous) return;

    this.redoStack.push({
      html: this.editor.innerHTML,
    });

    this.editor.innerHTML = previous.html;
  }

  redo() {
    const next = this.redoStack.pop();

    if (!next) return;

    this.undoStack.push({
      html: this.editor.innerHTML,
    });

    this.editor.innerHTML = next.html;
  }

  // ---------------------------------------------------------------------------
  // Formatting / Emmet
  // ---------------------------------------------------------------------------

  private getEmmet(parent: Node, operation?: StyleOperation) {
    const runs = this.flatten(parent, operation);
    console.log(runs);
    const merged = this.mergeRuns(runs);
    console.log(merged);
    const tree = this.buildTree(merged);
    console.log(tree);

    return this.toEmmetTree(tree);
  }

  private flatten(root: Node, operation?: StyleOperation) {
    const runs: TextRun[] = [];

    let applyingOperation = false;

    const visit = (node: Node, inherited: Styles) => {
      if (operation?.start === node) {
        applyingOperation = true;
      }

      const styles = { ...inherited };

      const styleOverrides = TAG_STYLE_OVERRIDES[node.nodeName.toUpperCase()];

      if (styleOverrides) {
        Object.assign(styles, styleOverrides);
      }

      switch (node.nodeType) {
        case Node.ELEMENT_NODE: {
          const el = node as HTMLElement;

          if (el instanceof HTMLBRElement) {
            runs.push({
              break: true,
              styles,
              text: '\n',
            });
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
            texts.forEach((part) => {
              if (!part) return;

              if (part.match(VARIABLE_REGEX)) {
                runs.push({
                  styles,
                  text: part,
                  variable: true,
                });
              } else {
                runs.push({
                  styles,
                  text: part,
                });
              }
            });

            break;
          }

          const styled = Object.assign({}, styles, operation.styles);

          let { start: sNode, startOffset: start, end: eNode, endOffset: end } = operation;

          start = Math.min(sNode === node ? start : 0, length);

          end = Math.min(eNode === node ? end : length, length);

          let size = 0;

          texts.filter(Boolean).forEach((part) => {
            const variable = part.match(VARIABLE_REGEX) != null;

            if (variable) {
              /*
               * Never actually split a variable.
               * A variable is treated as an atomic unit.
               */
              runs.push({
                styles: applyingOperation ? styled : styles,
                text: part,
                variable: true,
              });
            } else {
              const iS = applyingOperation ? Math.max(start - size, 0) : part.length;

              const iE = Math.min(end - size, part.length);

              const before = part.slice(0, iS);
              const middle = part.slice(iS, iE);
              const after = part.slice(iE);

              if (before) {
                runs.push({
                  styles,
                  text: before,
                });
              }

              if (middle) {
                runs.push({
                  styles: styled,
                  text: middle,
                });
              }

              if (after) {
                runs.push({
                  styles,
                  text: after,
                });
              }
            }

            size += part.length;
          });

          break;
        }
      }

      if (operation?.end === node) {
        applyingOperation = false;
      }
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

          if (previous.break) {
            delete previous.break;
          }

          continue;
        }

        const content = current.text.replaceAll(/(?=[^ ])\s/gi, '');
        const prevContent = previous.text.replaceAll(/(?=[^ ])\s/gi, '');

        const joined = previous.text + current.text;
        if (joined.match(VARIABLE_REGEX)) {
          const vals = joined.split(VARIABLE_SPLITTER);
          const [$1, $2, $3] = vals;

          const prev = vals.length === 3 ? $1 : !$1.match(VARIABLE_REGEX) ? $1 : null;
          const curr = vals.length === 3 ? $2 : $1.match(VARIABLE_REGEX) ? $1 : $2;
          const next = vals.length === 3 ? $3 : $1.match(VARIABLE_REGEX) ? $2 : null;

          if (!prev) {
            previous.text = curr;
            previous.variable = true;
          } else {
            previous.text = prev;

            const OBJ = Object.assign({}, previous, { variable: true });
            OBJ.text = curr;

            merged.push(OBJ);
          }

          current.text = next ?? '';
        } else if (!current.break && content.length && !content.trim()) {
          if (this.areStylesSafe(previous.styles)) {
            previous.text += current.text;
            continue;
          }
        } else if (!previous.break && prevContent.length && !prevContent.trim()) {
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

      if (current.text === '\n') {
        current.break = true;
      }

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
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

    return [...keys].every((key) => a[key as keyof Styles] === b[key as keyof Styles]);
  }

  private isInheritingStyles(a: Styles, b: Styles) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

    return [...keys].every((key) => {
      if (b[key as keyof Styles] === undefined) {
        return true;
      }

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

      for (const key of STYLE_ORDER) {
        if (previous && previous[key] === run.styles[key]) {
          continue;
        }

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

        styles.push({
          ...styles.at(-1),
          [key]: run.styles[key],
        });

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
        } else {
          root.push(`(${this.resolveEmmetElement(element)}>${this.toEmmetTree(element.children)})`);
        }
      } else if (element.type === 'variable') {
        root.push(`(var>{${element.text}})`);
      } else {
        element.text.split(/\n/gi).forEach((value, i, array) => {
          if (value !== '') {
            root.push(`{${value}}`);
          }

          if (array.length - 1 !== i) {
            root.push('br');
          }
        });
      }
    }

    return root.join('+');
  }

  private resolveEmmetElement<Style extends keyof Styles>(element: {
    type: 'style';
    style: Style;
    value: NonNullable<Styles[Style]>;
    children: TreeNode[];
  }) {
    const resolver = STYLE_OPTIONS[element.style]![2];

    return typeof resolver === 'function' ? resolver(element.value) : resolver;
  }
}
