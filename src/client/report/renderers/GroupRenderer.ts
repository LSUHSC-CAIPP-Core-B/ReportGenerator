import type { GroupManager } from '../managers/GroupManager.ts';

export class GroupRenderer {
  private manager: GroupManager;

  constructor(manager: GroupManager) {
    this.manager = manager;
  }

  toggleDragEffect(groupId: string, force: boolean | null = null) {
    const group = this.manager.getGroup(groupId);
    if (!group) return;

    const { content } = group;

    if (force === null) force = !content.classList.contains('drag-hover');
    content.classList.toggle('drag-hover', force);
  }
}
