import type { ReportElement } from './ReportElement.ts';

export class ReportGroup {
  identifier: string;
  title: string;
  menuEntry: HTMLElement;
  content: HTMLElement;
  depth: number;
  collapsed: boolean;

  parentId: string | null;
  elements: ReportElement[];

  constructor({
    identifier,
    title,
    menuEntry,
    content,
    parentId = null,
    depth = 0,
  }: {
    identifier: string;
    title: string;
    menuEntry: HTMLElement;
    content: HTMLElement;
    parentId: string | null;
    depth?: number;
  }) {
    this.identifier = identifier;
    this.title = title;

    this.parentId = parentId;
    this.depth = depth;

    this.collapsed = false;

    this.menuEntry = menuEntry;
    this.content = content;

    this.elements = [];
  }
}
