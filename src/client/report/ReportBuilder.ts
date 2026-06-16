import type { ProjectAction, ProjectActionType } from '../../shared/index.ts';
import { DragDropManager } from './managers/DragDropManager.ts';
import { ElementManager } from './managers/ElementManager.ts';
import { GroupManager } from './managers/GroupManager.ts';
import { LayoutManager } from './managers/LayoutManager.ts';
import { PendingInsertManager } from './managers/PendingInsertManager.ts';

export class ReportBuilder extends EventTarget {
  private title: string;
  private projectId: string;

  private layout: LayoutManager;
  private groups: GroupManager;
  private elements: ElementManager;
  private insert: PendingInsertManager;
  private dragdrop: DragDropManager;

  constructor(
    { title, project, groups = [] }: { title: string; project: string; groups: any[] },
    parent: HTMLElement = document.body,
  ) {
    super();

    this.title = title;
    this.projectId = project;

    this.layout = new LayoutManager(this, parent);
    this.groups = new GroupManager(this);
    this.elements = new ElementManager(this);
    this.insert = new PendingInsertManager(this);
    this.dragdrop = new DragDropManager(this);

    for (const group of groups) this.groups.create(group);
  }

  getProjectTitle() {
    return this.title;
  }

  getProjectId() {
    return this.projectId;
  }

  getDragDropManager() {
    return this.dragdrop;
  }

  getElementManager() {
    return this.elements;
  }

  getGroupManager() {
    return this.groups;
  }

  getLayoutManager() {
    return this.layout;
  }

  getPendingInsertManager() {
    return this.insert;
  }

  toggleFrames(force: boolean | null = null) {
    if (force == null) force = document.body.classList.contains('local');
    document.body.classList.toggle('local', !force);
  }

  withGroup(options: ProjectActionType<'group:create', 'type' | 'groupId' | 'parentId'>) {
    return this.groups.create(options);
  }

  insertElementIntoGroup(options: ProjectActionType<'element:create', 'type' | 'index'>) {
    return this.elements.insertElementIntoGroup(options);
  }

  destroy() {
    // this.dragdrop.destroy();
    this.layout.destroy();
  }

  emit<Action extends ProjectAction>(type: Action['type'], detail: Omit<Action, 'type'>) {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail: {
          timestamp: Date.now(),
          ...detail,
        },
      }),
    );
  }
}
