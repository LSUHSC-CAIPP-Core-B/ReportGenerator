// import { DocumentEditor } from 'client/editor/SelectionManager.ts';
import { DocumentEditor } from 'client/editor/Editor.ts';
import { handle } from 'client/iframe.ts';
import type { ReportBuilder } from 'client/report/ReportBuilder.ts';
import type { ReportDomGroup } from 'client/report/types.ts';
import { TableHandler } from 'client/table.ts';
import { e$ } from 'client/utils.ts';
import type {
  DescriptionElement,
  ElementShell,
  FrameElement,
  ImageElement,
  ProjectAction$CreateElement$Server,
  ProjectAction$DeleteGroup,
  ProjectGroup,
  TableElement,
} from 'common/project/types.ts';

type PendingItem = {
  groupId: string;
  element: HTMLElement;
};

export class LayoutManager {
  private readonly report: ReportBuilder;
  private readonly parent: HTMLElement;

  private menu!: HTMLElement;
  private content!: HTMLElement;

  private readonly GROUPS: Record<string, ReportDomGroup> = {};

  private pendingItem: PendingItem | null = null;

  constructor(report: ReportBuilder, parent: HTMLElement) {
    this.report = report;
    this.parent = parent;

    this.createSidebar();
    this.registerListeners();
  }

  private createSidebar() {
    const wrapper = e$('.b-menu>.menu-title{Table of Contents}+.menu-container') as HTMLElement;

    this.menu = wrapper!.querySelector('.menu-container') as HTMLElement;
    this.content = e$('.b-content') as HTMLElement;

    this.parent.append(wrapper, this.content);
  }

  private registerListeners() {
    this.report.addEventListener('group:create', (event) => this.createGroup(event.detail));

    this.report.addEventListener('group:delete', (event) => this.deleteGroup(event.detail));

    this.report.addEventListener('element:create', (event) => this.createElement(event.detail));
  }

  private createGroup({ identifier, title, depth, parentId }: ProjectGroup): void {
    if (this.GROUPS[identifier]) {
      this.deleteGroup({ groupId: identifier });
    }

    this.menu.appendChild(
      e$(
        `.menu-entry[aria-identifier=${identifier}]` +
          (depth && parentId ? `.indent[style="--menu-indent:${depth}"]` : '') +
          `>p.desc{${title}}`,
      ) as HTMLElement,
    );

    const container = e$(`.b-container[aria-identifier=${identifier}]`) as HTMLElement;

    /*
     * Add-item button.
     *
     * This is attached directly to the group, so clicking it starts
     * the pending-item flow for this specific group.
     */
    const addButton = e$(
      `button.b-group-add[type=button][aria-label="Add item"]{+ Add item}`,
    ) as HTMLButtonElement;

    addButton.addEventListener('click', () => {
      this.beginPendingItem(identifier);
    });

    container.appendChild(addButton);
    this.content.appendChild(container);

    this.GROUPS[identifier] = {
      container,
      parentId,
    };
  }

  private deleteGroup({ groupId: identifier }: ProjectAction$DeleteGroup): void {
    document.querySelector(`.menu-entry[aria-identifier=${identifier}]`)?.remove();

    document.querySelector(`.b-container[aria-identifier=${identifier}]`)?.remove();

    if (this.pendingItem?.groupId === identifier) {
      this.cancelPendingItem();
    }

    delete this.GROUPS[identifier];
  }

  /**
   * Starts the "add item" flow for a group.
   *
   * The user clicks "+ Add item", and we add a temporary element
   * into that group. The actual file/type is supplied later by
   * the caller through finishPendingItem().
   */
  public beginPendingItem(groupId: string): void {
    const group = this.GROUPS[groupId];

    if (!group) {
      throw new Error(`Invalid group: ${groupId}`);
    }

    // Only allow one pending item at a time.
    this.cancelPendingItem();

    const element = e$(
      `.b-element.pending[aria-label="Select item"]` +
        `>span.desc-block` +
        `>i.desc-icon.icon-plus` +
        `+p.desc-text{Select item}`,
    ) as HTMLElement;

    element.addEventListener('click', () => {
      /*
       * The actual file picker should be opened by the caller.
       *
       * We expose the group through getPendingGroup() so the
       * existing file-picker flow can finish the item.
       */
      this.parent.dispatchEvent(
        new CustomEvent('layout:item:select', {
          detail: {
            groupId,
          },
        }),
      );
    });

    group.container.appendChild(element);

    this.pendingItem = {
      element,
      groupId,
    };
  }

  /**
   * Complete the currently pending item.
   *
   * `file` is expected to be the file selected by your existing
   * file picker.
   *
   * `key` is the element type, e.g. "table", "image", etc.
   */
  public finishPendingItem(
    file: {
      id: string;
      type: string;
    },
    key: string,
  ): void {
    if (!this.pendingItem) {
      return;
    }

    const { groupId, element } = this.pendingItem;

    element.remove();
    this.pendingItem = null;

    /*
     * This is the object you described:
     *
     * {
     *   data: {
     *     file: file.id,
     *     type: file.type,
     *   },
     *   type: key,
     * }
     */
    const options = {
      data: {
        file: file.id,
        type: file.type,
      },
      type: key,
    };

    /*
     * Hand the new element to ReportBuilder.
     *
     * Replace this with whatever method in ReportBuilder currently
     * creates ProjectAction$CreateElement$Server.
     */
    // this.report.createElement(groupId, options);
  }

  /**
   * Cancel the pending item without creating anything.
   */
  public cancelPendingItem(): void {
    this.pendingItem?.element.remove();
    this.pendingItem = null;
  }

  /**
   * Returns the group currently waiting for a file/item selection.
   */
  public getPendingGroup(): string | null {
    return this.pendingItem?.groupId ?? null;
  }

  private createElement({ groupId, options: element }: ProjectAction$CreateElement$Server): void {
    const { type } = element;

    switch (type) {
      case 'table':
        this.createTableElement(groupId, element);
        break;

      case 'image':
        this.createImageElement(groupId, element);
        break;

      case 'frame':
        this.createFrameElement(groupId, element);
        break;

      case 'description':
        this.createDescriptionElement(groupId, element);
        break;

      default:
        throw new Error(`Invalid element type: ${type satisfies never}`);
    }
  }

  private createElementShell({
    identifier,
    icon = 'group',
    details = 'Element Group',
  }: ElementShell) {
    return e$(
      `.b-element[aria-identifier=${identifier}][draggable=true]` +
        `>span.desc-block` +
        `>i.desc-icon.icon-${icon}` +
        `+p.desc-text{${details}}` +
        `+span.insertion.before` +
        `+span.insertion.after`,
    ) as HTMLElement;
  }

  private createTableElement(parent: string, { identifier, data }: Required<TableElement>) {
    const { type = 'csv', file, hash, extras } = data ?? {};

    const project = this.report.getProjectPath();

    if (!file && !hash) {
      return null;
    }

    const shell = this.createElementShell({
      details: 'Description',
      icon: 'text',
      identifier,
    });

    if (parent && this.GROUPS[parent]) {
      this.GROUPS[parent].container.appendChild(shell);
    }

    const encoded = encodeURIComponent((hash ?? file)!);

    const lookup = `/database/${hash ? 'hash' : 'file'}/` + `${project}/${encoded}/@`;

    const table = e$(
      `table.b-table[aria-table="${lookup}"]` +
        `[aria-filetype=${type}]` +
        (extras?.index ? '[aria-row-index]' : '') +
        (Array.isArray(extras?.column_order)
          ? `[aria-column-order=${extras.column_order.join(',')}]`
          : ''),
    ) as HTMLTableElement;

    TableHandler.fromElement(table);

    shell.appendChild(table);
  }

  private createImageElement(parent: string, { identifier, data }: Required<ImageElement>) {
    const { file, hash } = data ?? {};

    const project = this.report.getProjectPath();

    if (!file && !hash) {
      return null;
    }

    const shell = this.createElementShell({
      icon: 'image',
      identifier,
    });

    if (parent && this.GROUPS[parent]) {
      this.GROUPS[parent].container.appendChild(shell);
    }

    const encoded = encodeURIComponent((hash ?? file)!);

    const lookup = `/database/${hash ? 'hash' : 'file'}/` + `${project}/${encoded}/@`;

    const image = e$(`img.b-image[src="${lookup}"]`) as HTMLImageElement;

    image.alt = `Unable to load image: ${lookup}`;

    shell.appendChild(image);
  }

  private createFrameElement(parent: string, { identifier, data }: Required<FrameElement>) {
    const { file, hash } = data ?? {};

    const project = this.report.getProjectPath();

    if (!file && !hash) {
      return null;
    }

    const shell = this.createElementShell({
      icon: 'pointer',
      identifier,
    });

    if (parent && this.GROUPS[parent]) {
      this.GROUPS[parent].container.appendChild(shell);
    }

    const encoded = encodeURIComponent((hash ?? file)!);

    const lookup = `/database/${hash ? 'hash' : 'file'}/` + `${project}/${encoded}/@`;

    const frame = e$(`iframe.b-frame[src="${lookup}"]`) as HTMLIFrameElement;

    shell.appendChild(frame);

    handle(frame);
  }

  private createDescriptionElement(
    parent: string,
    { identifier, data }: Required<DescriptionElement>,
  ) {
    const { description } = data ?? {};

    const shell = this.createElementShell({
      details: 'Description',
      icon: 'text',
      identifier,
    });

    if (parent && this.GROUPS[parent]) {
      this.GROUPS[parent].container.appendChild(shell);
    }

    const container = e$('div[contenteditable=true]') as HTMLDivElement;

    shell.appendChild(container);

    container.replaceChildren(e$(description ?? ''));

    new DocumentEditor(container);
  }
}
// ```

// The resulting interaction is:

// **Group → `+ Add item` → pending “Select item” element → your file picker → `finishPendingItem(file, key)` → normal `element:create` rendering.**

// One thing you’ll need to adapt is this line:

// ```ts
// this.report.createElement(groupId, options);
// ```

// I don't have the `ReportBuilder` implementation, so I can't know the exact method you currently use to send the create action. The rest of the click/pending-item flow is independent of that API.

// If your existing `beginPendingItem({ data, type })` is actually a method **outside `LayoutManager`**, then I can simplify this further so the `+ Add item` click directly calls your existing method and you don't need `finishPendingItem()` at all.
