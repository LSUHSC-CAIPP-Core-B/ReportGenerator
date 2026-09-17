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

export class LayoutManager {
  private readonly report: ReportBuilder;
  private readonly parent: HTMLElement;

  private menu!: HTMLElement;
  private content!: HTMLElement;

  private readonly GROUPS: Record<string, ReportDomGroup> = {};

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
    if (this.GROUPS[identifier]) this.deleteGroup({ groupId: identifier });

    this.menu.appendChild(
      e$(
        `.menu-entry[aria-identifier=${identifier}]` +
          (depth && parentId ? `.indent[style="--menu-indent:${depth}"]` : '') +
          `>p.desc{${title}}`,
      ) as HTMLElement,
    );

    const container = e$(`.b-container[aria-identifier=${identifier}]`) as HTMLElement;
    this.content.appendChild(container);

    this.GROUPS[identifier] = { container, parentId };
  }

  private deleteGroup({ groupId: identifier }: ProjectAction$DeleteGroup): void {
    document.querySelector(`.menu-entry[aria-identifier=${identifier}]`)?.remove();
    document.querySelector(`.b-container[aria-identifier=${identifier}]`)?.remove();

    delete this.GROUPS[identifier];
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
    if (!file && !hash) return null;

    const shell = this.createElementShell({ details: 'Description', icon: 'text', identifier });
    if (parent && this.GROUPS[parent]) this.GROUPS[parent].container.appendChild(shell);

    const encoded = encodeURIComponent((hash ?? file)!);
    const lookup = `/database/${hash ? 'hash' : 'file'}/${project}/${encoded}/@`;
    const table = e$(
      `table.b-table[aria-table="${lookup}"][aria-filetype=${type}]` +
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
    if (!file && !hash) return null;

    const shell = this.createElementShell({ icon: 'image', identifier });
    if (parent && this.GROUPS[parent]) this.GROUPS[parent].container.appendChild(shell);

    const encoded = encodeURIComponent((hash ?? file)!);
    const lookup = `/database/${hash ? 'hash' : 'file'}/${project}/${encoded}/@`;
    const image = e$(`img.b-image[src="${lookup}"]`) as HTMLImageElement;
    image.alt = `Unable to load image: ${lookup}`;
    shell.appendChild(image);
  }

  private createFrameElement(parent: string, { identifier, data }: Required<FrameElement>) {
    const { file, hash } = data ?? {};
    const project = this.report.getProjectPath();
    if (!file && !hash) return null;

    const shell = this.createElementShell({ icon: 'pointer', identifier });
    if (parent && this.GROUPS[parent]) this.GROUPS[parent].container.appendChild(shell);

    const encoded = encodeURIComponent((hash ?? file)!);
    const lookup = `/database/${hash ? 'hash' : 'file'}/${project}/${encoded}/@`;
    const frame = e$(`iframe.b-frame[src="${lookup}"]`) as HTMLIFrameElement;
    shell.appendChild(frame);
    handle(frame);
  }

  private createDescriptionElement(
    parent: string,
    { identifier, data }: Required<DescriptionElement>,
  ) {
    const { description } = data ?? {};

    const shell = this.createElementShell({ details: 'Description', icon: 'text', identifier });
    if (parent && this.GROUPS[parent]) this.GROUPS[parent].container.appendChild(shell);

    const container = e$('div[contenteditable=true]') as HTMLDivElement;
    shell.appendChild(container);

    container.replaceChildren(e$(description ?? ''));
    new DocumentEditor(container);
  }
}
