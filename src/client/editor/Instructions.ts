import {
  type ElementStyleTag,
  type ElementTag,
  type GenericTextTagType,
  isElement,
  isLineBreak,
  isStyleTag,
  isTextTag,
  isVariable,
  isVariableCheckTag,
  isVariableTag,
  isVariableUnwrapTag,
  isWhitespace,
  notSpecialTag,
} from 'client/editor/DomTags.ts';

//
// Tags to DOM
//

/**
 * Convert grouped tags into concrete instructions for modifying the DOM.
 *
 * This is the final planning phase. No DOM changes should happen here;
 * instead, the function describes what `applyInstructions` needs to do.
 */
export function createInstructions(groups: ElementTag[][]) {
  const out: Instructions[] = [];

  /**
   * Keep track of open style tags so consecutive equivalent styles can
   * potentially be merged.
   */
  const styles: ElementStyleTag<'STYLE_START' | 'STYLE_STOP'>[] = [];

  /**
   * Tracks whether we're currently inside a variable expression.
   *
   * `groupIndex` and `elementIndex` identify where the variable began.
   */
  const captureSettings = {
    elementIndex: -1,
    groupIndex: -1,
    isCapturing: false,
  };

  for (let h = 0; h < groups.length; h++) {
    const group = groups[h];

    for (let i = 0; i < group.length; i++) {
      const element = group[i];

      if (isWhitespace(element) || isLineBreak(element)) {
        let beforeSelf = group.filter((_value, index) => index < i).findLast(notSpecialTag);
        if (beforeSelf && (isVariableTag(beforeSelf) || isVariableUnwrapTag(beforeSelf)))
          beforeSelf = undefined;

        let afterSelf = group.filter((_value, index) => index > i).find(notSpecialTag);
        if (afterSelf && (isVariableTag(afterSelf) || isVariableUnwrapTag(afterSelf)))
          afterSelf = undefined;

        const sibling = beforeSelf ?? afterSelf;

        if (sibling) {
          /**
           * Find an existing replacement instruction for the sibling node.
           *
           * Multiple whitespace nodes may need to be inserted into the same
           * replacement operation.
           */
          let instruction = out
            .filter(
              (instruction): instruction is SelfReplaceInstruction =>
                instruction.type === 'SELF_REPLACE',
            )
            .find(({ target, with: $with }) => {
              return target === sibling.node || $with.includes(sibling.node);
            });

          if (!instruction) {
            instruction = {
              target: sibling.node,
              type: 'SELF_REPLACE',
              with: [sibling.node],
            };

            out.push(instruction);
          }

          /**
           * Place the whitespace either before or after the sibling,
           * depending on which side of the sibling it originally appeared.
           */
          const j = instruction.with.indexOf(sibling.node) + (beforeSelf ? 1 : 0);

          instruction.with.splice(j, 0, element.node);

          /**
           * The original whitespace node is now represented by the
           * replacement instruction, so remove it from the DOM.
           */
          out.push({
            target: element.node,
            type: 'SELF_REMOVE',
          });
        }
      } else if (isStyleTag(element)) {
        if (element.type === 'STYLE_START') {
          // Find the most recent compatible style reference.
          const lastRef = styles.findLast(
            (style) =>
              style.type !== 'STYLE_STOP' ||
              (style.style === element.style && style.value === element.value),
          );

          if (lastRef?.type === 'STYLE_STOP') {
            /*
             * A style can be merged when its closing tag belongs to the
             * current group or the immediately preceding group, and it is
             * the most recently tracked style.
             */
            const canMerge =
              (group.some((tag) => tag.node === lastRef.node) ||
                groups.at(Math.max(0, h - 1))?.some((tag) => tag.node === lastRef.node)) &&
              styles.indexOf(lastRef) === styles.length - 1;

            if (canMerge) {
              // Move the children into the existing style element.
              out.push({
                target: element.node,
                to: lastRef.node,
                type: 'CHILDREN_MOVE',
              });

              // Then remove the now-empty duplicate style element.
              out.push({
                target: element.node,
                type: 'SELF_REMOVE',
              });
            }
          }
        }

        /**
         * Avoid adding style references for nodes that have already been
         * scheduled to have their children moved elsewhere.
         */
        const hasMoveInstruction = out.some(
          (instruction) =>
            instruction.type === 'CHILDREN_MOVE' && instruction.target === element.node,
        );

        if (!hasMoveInstruction) {
          styles.push(element);
        }
      } else if (element.type === 'VARIABLE_UNWRAP') {
        /**
         * An invalid <var> should no longer behave like a variable.
         *
         * Replace the <var> element with its original children.
         */
        out.push({
          target: element.node,
          type: 'SELF_REPLACE',
          with: [...element.node.childNodes],
        });
      } else if (isVariableCheckTag(element)) {
        /**
         * VARIABLE_START begins variable capture.
         */
        if (element.type === 'VARIABLE_START') {
          captureSettings.isCapturing = true;
          captureSettings.groupIndex = h;
          captureSettings.elementIndex = i;
        } else {
          /**
           * VARIABLE_STOP ends variable capture.
           */
          if (captureSettings.isCapturing) {
            /**
             * Select all groups touched by the variable.
             */
            const lookupGroups = groups.filter(
              (_value, index) => index >= captureSettings.groupIndex && index <= h,
            );

            /**
             * These are all text-like elements in the affected groups.
             */
            const uncapturedElements = lookupGroups.flat().filter(isTextTag);

            /**
             * Restrict the lookup to the exact range between the variable
             * delimiters.
             */
            const lookupElements = lookupGroups
              .flatMap((group, groupIndex, { length }) =>
                group.slice(
                  groupIndex === 0 ? captureSettings.elementIndex : 0,
                  length - 1 === groupIndex ? i + 1 : group.length,
                ),
              )
              .filter((tag) => isTextTag(tag));

            /**
             * Reconstruct the text represented by the captured tags.
             */
            const content = lookupElements.reduce((result, tag) => result + tag.text, '');

            /**
             * Verify that the captured text is actually a valid variable.
             */
            const matches = isVariable(content);

            if (matches) {
              /**
               * Process every group touched by the variable.
               */
              for (const group of lookupGroups) {
                const lookupIds = lookupElements.map(({ identifier }) => identifier);

                /**
                 * Find the corresponding uncaptured element in this group.
                 */
                const target = uncapturedElements.find(
                  (candidate) =>
                    lookupIds.includes(candidate.identifier) && group.includes(candidate),
                )!;

                /**
                 * Determine whether this target contains the beginning of
                 * the variable.
                 */
                const isFirst = lookupIds.indexOf(target.identifier) === 0;

                /**
                 * Find an existing replacement instruction for the target.
                 */
                let replaceSelf = out
                  .filter(
                    (instruction): instruction is SelfReplaceInstruction =>
                      instruction.type === 'SELF_REPLACE',
                  )
                  .find((instruction) => instruction.target === target.node);

                if (!replaceSelf) {
                  /**
                   * Find all text tags in this group belonging to the
                   * target DOM node.
                   */
                  const children = group
                    .filter(isTextTag)
                    .filter(({ node }) => node === target.node);

                  /**
                   * If this isn't the first variable segment and this node
                   * contains only the current segment, the node can simply
                   * be removed.
                   */
                  if (
                    !isFirst &&
                    children.length === 1 &&
                    children[0].identifier === target.identifier
                  ) {
                    out.push({
                      target: target.node,
                      type: 'SELF_REMOVE',
                    });

                    continue;
                  }

                  /**
                   * Otherwise create a replacement instruction containing
                   * the target's current content.
                   */
                  replaceSelf = {
                    target: target.node,
                    type: 'SELF_REPLACE',
                    with: children,
                  };

                  out.push(replaceSelf);
                }

                /**
                 * Locate the original position of the target within the
                 * replacement contents.
                 */
                const index = replaceSelf.with.findIndex(
                  (node) =>
                    typeof node !== 'string' &&
                    'identifier' in node &&
                    typeof node.identifier === 'string' &&
                    node.identifier === target.identifier,
                );

                /**
                 * Remove all captured pieces from the replacement.
                 *
                 * They will be replaced by the complete variable string
                 * when this is the first captured element.
                 */
                replaceSelf.with = replaceSelf.with.filter(
                  (node) =>
                    typeof node === 'string' ||
                    !(
                      'identifier' in node &&
                      typeof node.identifier === 'string' &&
                      (lookupIds.includes(node.identifier) || target.identifier === node.identifier)
                    ),
                );

                /**
                 * Insert the complete variable only once, at the position
                 * occupied by the first captured piece.
                 */
                if (isFirst) {
                  replaceSelf.with.splice(index, 0, content);
                }
              }
            }
          }

          captureSettings.isCapturing = false;
        }
      }
    }
  }

  return out;
}

/**
 * Apply the generated DOM-editing instructions.
 */
export function applyInstructions(instructions: Instructions[]) {
  for (const edit of instructions) {
    const { type, target } = edit;

    /**
     * Most instructions operate on DOM elements, but text nodes are also
     * valid targets. Keep the element-specific reference only when needed.
     */
    const element = isElement(target) ? target : null;

    if (type === 'SELF_REMOVE') {
      if (element) {
        element.remove();
      } else {
        target.parentNode?.removeChild(target);
      }
    } else if (type === 'CHILDREN_MOVE') {
      // Move every child from the target node into the destination node.
      while (target.firstChild) {
        edit.to.appendChild(target.firstChild);
      }

      joinAdjacentNodes(edit.to);
    } else if (type === 'SELF_REPLACE') {
      // Convert the instruction's abstract contents into actual DOM nodes.
      const content = edit.with.reduce(joinNodesAndText, []).map(makeNode);

      if (element) {
        element.replaceWith(...content);
        continue;
      }

      const parent = target.parentNode;
      if (!parent) continue;

      if (content.length === 0) {
        parent.removeChild(target);
        continue;
      }

      /*
       * Text-node targets are slightly more complicated.
       *
       * If every generated node is text, we can simply update the existing
       * text node. Otherwise, the original node must be removed and the
       * generated nodes inserted in its place.
       */

      // const allText = content.every(
      //   (node) => node.nodeType === Node.TEXT_NODE && node.nodeValue !== '\n',
      // );

      // if (allText) {
      //   target.nodeValue = content.map(getStr).join('');
      //   continue;
      // }

      for (const node of content) {
        parent.insertBefore(node, target);
      }

      parent.removeChild(target);
      joinAdjacentNodes(parent);
    } else {
      /*
       * If a new instruction type is added without being handled above,
       * TypeScript will flag this location.
       */
      throw new Error(`Unknown instruction type: ${type satisfies never}`);
    }
  }
}

//
// Helper Functions
//

/*
 * Moving children can leave adjacent text nodes.
 * Merge adjacent text nodes so that there are no adjacent nodes.
 */
export function joinAdjacentNodes(parent: Node) {
  let changed = false;
  let target = parent.firstChild;

  while (target) {
    const next = target.nextSibling;
    if (!next || target.parentNode !== next.parentNode) break;

    if (target.nodeType === Node.TEXT_NODE && next.nodeType === Node.TEXT_NODE) {
      target.nodeValue = getStr(target) + getStr(next);
      next.remove();
      changed = true;
    } else target = next;
  }

  return changed;
}

/**
 * Combine strings, text nodes, and text-tag objects into a normalized
 * sequence of strings and DOM nodes.
 *
 * This function also converts complete template variables into <var>
 * elements so that variables have an explicit representation in the DOM.
 */
function joinNodesAndText(
  arr: (string | Node)[],
  b: string | Node | GenericTextTagType,
): (string | Node)[] {
  /**
   * A complete variable is represented as a <var> element.
   *
   * For example:
   *
   *   "[[user.name]]"
   *
   * becomes:
   *
   *   <var>[[user.name]]</var>
   */
  if (typeof b === 'string') {
    if (isVariable(b)) {
      const variable = document.createElement('var');
      variable.textContent = b;
      arr.push(variable);
      return arr;
    }
  } else if (isElement(b) && b.tagName === 'BR') {
    (b as any) = '\n';
  }

  /**
   * A text-like value can either be a normal string or one of our
   * GenericTextTagType objects.
   */
  const isStrB = typeof b === 'string' || 'text' in b;

  /**
   * Determine whether the incoming value is an actual DOM text node.
   */
  const isTextB = !isStrB && b.nodeType === Node.TEXT_NODE;

  /**
   * Extract the textual representation when possible.
   */
  const bStr = isStrB ? (typeof b === 'string' ? b : b.text) : null;

  /**
   * Look at the previously accumulated value so adjacent text can
   * be merged instead of producing unnecessary DOM nodes.
   */
  const last = arr.at(-1);

  if (!last) {
    return [bStr ?? (b as Node)];
  }

  const isStrA = typeof last === 'string';
  const isTextA = !isStrA && last.nodeType === Node.TEXT_NODE;

  /**
   * Merge the four possible combinations:
   *
   *   string + string
   *   string + text node
   *   text node + string
   *   text node + text node
   *
   * Non-text values are kept as separate nodes.
   */
  if (isStrA && isStrB) {
    arr.splice(-1, 1, last + bStr);
  } else if (isStrA && isTextB) {
    arr.splice(-1, 1, last + getStr(b));
  } else if (isTextA && isStrB) {
    arr.splice(-1, 1, getStr(last) + bStr);
  } else if (isTextA && isTextB) {
    arr.splice(-1, 1, getStr(last) + getStr(b));
  } else {
    arr.push(bStr ?? (b as Node));
  }

  return arr;
}

function getStr(a: Node) {
  return a.nodeValue ?? '';
}

function makeNode(value: string | Node): Node {
  return typeof value === 'string' ? document.createTextNode(value) : value;
}

/**
 * Remove a DOM node entirely.
 */
export type RemoveSelfInstruction = {
  type: 'SELF_REMOVE';
  target: Node;
};

/**
 * Replace one DOM node with a collection of text, tag, or DOM-node values.
 */
export type SelfReplaceInstruction = {
  type: 'SELF_REPLACE';
  target: Node;
  with: (Node | string | GenericTextTagType)[];
};

/**
 * Move all children from one node into another.
 */
export type ChildrenMoveInstruction = {
  type: 'CHILDREN_MOVE';
  target: Node;
  to: Node;
};

/**
 * Every operation that can be performed during DOM cleanup.
 */
export type Instructions = RemoveSelfInstruction | SelfReplaceInstruction | ChildrenMoveInstruction;
