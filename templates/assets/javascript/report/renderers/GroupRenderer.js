import { GroupManager } from "../managers/GroupManager.js";

export class GroupRenderer {


    /** @type {GroupManager} */
    #manager;

    /**
     * @param {GroupManager} manager 
     */
    constructor(manager) {
        this.#manager = manager;
    }

    /**
     * @param {string} groupId
     * @param {boolean} force 
     */
    toggleDragEffect(groupId, force = null) {
        const group = this.#manager.getGroup(groupId);
        if (!group) return;

        const { content } = group;

        if (force === null) force = !content.classList.contains('drag-hover');
        content.classList.toggle('drag-hover', force);
    }


}
