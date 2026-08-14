import {
  createElementTags,
  groupSimilarElementTags,
  isElement,
  isVariable,
} from 'client/editor/DomTags.ts';
import {
  applyInstructions,
  createInstructions,
  joinAdjacentNodes,
} from 'client/editor/Instructions.ts';
import { tags } from 'liquidjs';
import { createToJSONSchemaMethod } from 'zod/v4/core';

/**
 * Main editor wrapper.
 *
 * The editor watches the DOM for selection and keyboard changes and
 * periodically normalizes its structure so that equivalent formatting
 * and text nodes can be merged together.
 */
export class DocumentEditor {
  private readonly editor: HTMLElement;
  private selection: { start: number; end: number; parent: Node } | null = null;

  /**
   * Construct an editor from either a selector/id or an existing element.
   */
  constructor(elementOrId: string);
  constructor(elementOrId: HTMLElement);
  constructor(elementOrId: string | HTMLElement) {
    /**
     * Resolve the supplied value into the actual editor element.
     *
     * The non-null assertion here is only temporary; the result is
     * explicitly checked immediately afterward.
     */
    const editor =
      typeof elementOrId === 'string'
        ? document.querySelector<HTMLElement>(elementOrId)
        : elementOrId;

    if (!editor) {
      throw new Error(`Editor doesn't exist or wasn't found: ${elementOrId}`);
    }

    this.editor = editor;

    document.removeEventListener('selectionchange', this.onSelection);
    document.addEventListener('selectionchange', this.onSelection);

    this.editor.removeEventListener('keydown', this.onKeyPress);
    this.editor.addEventListener('keydown', this.onKeyPress);

    this.refreshEditor();
  }

  /**
   * Handle selection changes.
   */
  private onSelection = () => {
    const selection = window.getSelection();
    const canSelect = Boolean(selection?.rangeCount);

    this.editor.querySelectorAll('var').forEach((target) => {
      const textSelected =
        canSelect && [...target.childNodes].some((node) => selection!.containsNode(node));
      target.classList.toggle('active', textSelected);
    });
  };

  /**
   * Handle keyboard input.
   */
  onKeyPress = async (event: KeyboardEvent) => {
    if (!event.metaKey && !event.ctrlKey) {
      this.handleNormalKey(event);
      // return;
    } else {
      // this.handleShortcut(event);
    }

    /*
     * Let the browser perform the normal editing operation first.
     * This is important because we need to inspect the resulting text
     * when the user is typing inside a variable.
     */
    await desync();

    this.saveSelectionRelativePos(this.editor);
    if (this.refreshSelection()) this.loadSelectionRelativePos(this.editor);
  };

  private handleNormalKey(event: KeyboardEvent) {
    if (event.key.startsWith('Arrow')) return;
    // We want to synthetically add a new line
    if (event.key === 'Enter') {
      event.preventDefault();

      const selection = window.getSelection();
      if (!selection?.rangeCount) return;

      const range = selection.getRangeAt(0);

      // Replace the current selection with a literal newline
      range.deleteContents();

      const newline = document.createTextNode('\n');
      range.insertNode(newline);

      // Move cursor after the newline
      range.setStartAfter(newline);
      range.collapse(true);

      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  private saveSelectionRelativePos(root: Node) {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      this.selection = null;
      return;
    }

    const range = selection.getRangeAt(0);

    // Make sure the selection is actually inside the root.
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
      this.selection = null;
      return;
    }

    const getOffset = (container: Node, offset: number): number => {
      const tempRange = document.createRange();

      tempRange.selectNodeContents(root);
      tempRange.setEnd(container, offset);

      return tempRange.toString().length;
    };

    const start = getOffset(range.startContainer, range.startOffset);

    const end = getOffset(range.endContainer, range.endOffset);

    this.selection = {
      end,
      parent: root,
      start,
    };

    console.log(this.selection);
  }

  private loadSelectionRelativePos(root: Node) {
    const saved = this.selection;

    if (!saved) return;

    const { start, end } = saved;

    const getTextNodes = (root: Node): Text[] => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

      const nodes: Text[] = [];

      let node = walker.nextNode();

      while (node) {
        nodes.push(node as Text);
        node = walker.nextNode();
      }

      return nodes;
    };

    const getPosition = (offset: number) => {
      const textNodes = getTextNodes(root);

      let remaining = offset;

      for (const node of textNodes) {
        const length = node.data.length;

        if (remaining <= length) {
          return {
            node,
            offset: remaining,
          };
        }

        remaining -= length;
      }

      // Root contains no text.
      if (textNodes.length === 0) {
        return {
          node: root,
          offset: root.childNodes.length,
        };
      }

      // Offset is past the end — clamp to the end.
      const lastNode = textNodes[textNodes.length - 1];

      return {
        node: lastNode,
        offset: lastNode.data.length,
      };
    };

    const startPosition = getPosition(start);
    const endPosition = getPosition(end);

    const range = document.createRange();

    range.setStart(startPosition.node, startPosition.offset);

    range.setEnd(endPosition.node, endPosition.offset);

    const selection = window.getSelection();

    if (!selection) return;

    selection.removeAllRanges();
    selection.addRange(range);
  }

  /**
   * Inspect the current DOM and apply any required normalization edits.
   *
   * The process is split into three phases:
   *
   * 1. Convert the DOM into a linear list of semantic tags.
   * 2. Group compatible tags together.
   * 3. Convert those groups into concrete DOM-editing instructions.
   */
  refreshEditor() {
    this.refreshDom(this.editor);
  }

  private refreshSelection() {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return false;

    const target = selection.anchorNode;
    if (!target) return false;

    const targetElement = isElement(target) ? target : target.parentElement!;
    const shouldUpdate = this.editor.contains(targetElement) || this.editor === targetElement;
    if (!shouldUpdate) return false;

    return this.refreshDom(targetElement);
  }

  /**
   * Inspect the current DOM and apply any required normalization edits.
   *
   * The process is split into three phases:
   *
   * 1. Convert the DOM into a linear list of semantic tags.
   * 2. Group compatible tags together.
   * 3. Convert those groups into concrete DOM-editing instructions.
   */
  private refreshDom(element: HTMLElement) {
    const parent = element.parentElement;
    const tags = createElementTags(element);
    const groups = groupSimilarElementTags(tags);
    const instructions = createInstructions(groups);
    applyInstructions(instructions);

    const target = element.parentElement ? element : parent;
    if (target && joinAdjacentNodes(target)) return true;
    return instructions.length > 0;
  }
}

//
// Helper Functions
//

const desync = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
