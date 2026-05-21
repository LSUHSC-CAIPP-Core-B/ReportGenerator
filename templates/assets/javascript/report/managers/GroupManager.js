import { ReportGroup } from '../models/ReportGroup.js';
import { ReportBuilder } from '../ReportBuilder.js';
import { getDescendants, getSubtree } from '../utils/groupTree.js';
import { createIdentifier } from '../utils/identifiers.js';

export class GroupManager {

    /** @type {Map<string, ReportGroup>} */
    #groups = new Map();
    /** @type {string[]} */
    #groupOrder = [];

    /** @type { ReportBuilder } */
    #report

    /**
     * @param {ReportBuilder} report
     */
    constructor(report) {
        this.#report = report;
    }


    /**
     * @param {Object} options
     * @param {string} options.title
     * @param {any[]} options.elements
     * @param {string} [options.identifier]
     * @param {string} [options.parentId]
     */
    create({ title, elements = [], identifier = createIdentifier(), parentId = null }) {
        const depth = parentId
            ? (this.#groups.get(parentId)?.depth ?? 0) + 1
            : 0;

        const layoutManager = this.#report.getLayoutManager();
        const dragDropManager = this.#report.getDragDropManager();
        const elementManager = this.#report.getElementManager();
        const insertManager = this.#report.getPendingInsertManager();

        const { entry: menuEntry, content } = layoutManager.create({ title, identifier, depth });

        if (parentId)
            layoutManager.getMenuEntry(parentId)
                ?.classList.toggle('collapsable', true);

        const group = new ReportGroup({
            id: identifier,
            title,
            menuEntry,
            content,
            parentId,
            depth
        });

        this.#groups.set(identifier, group);
        this.#groupOrder.push(identifier);

        for (const element of elements)
            elementManager.addElementToGroup(identifier, element);

        dragDropManager.attachGroupEvents(identifier);
        insertManager.attachGroupEvents(identifier);
        return group;
    }

    /**
     * @param {string} groupId
     * @param {string} targetId
     * @param {'before'|'after'|'inside'} position
     */
    moveGroup(groupId, targetId, position = 'after') {
        if (groupId === targetId) return;

        const movingSubtree = this.getSubtree(groupId);
        if (!movingSubtree.length) return;

        const movingIds = movingSubtree.map(g => g.id);
        // Prevent dropping into own subtree
        if (movingIds.includes(targetId)) return;

        const target = this.#groups.get(targetId);
        const root = this.#groups.get(groupId);
        if (!root || !target) return;

        this.#groupOrder = this.#groupOrder.filter(
            id => !movingIds.includes(id)
        );

        if (position === 'inside') root.parentId = target.id;
        else root.parentId = target.parentId;

        this.#updateSubtreeDepths(groupId);

        let insertIndex = this.#groupOrder.indexOf(targetId);

        if (position !== 'before') {
            insertIndex++;

            while (insertIndex < this.#groupOrder.length) {
                const current = this.#groups.get(this.#groupOrder[insertIndex]);
                if (!current) break;
                if (current.depth <= target.depth) break;
                insertIndex++;
            }
        }

        this.#groupOrder.splice(insertIndex, 0, ...movingIds);
        this.#rebuildGroupDOM();
    }


    getDescendants(groupId) {
        return getDescendants(this, groupId);
    }

    getSubtree(groupId) {
        return getSubtree(this, groupId);
    }

    #updateSubtreeDepths(rootId) {
        const root = this.#groups.get(rootId);
        if (!root) return;

        const subtree = this.getSubtree(rootId);

        const rootDepth = root.parentId
            ? (this.#groups.get(root.parentId)?.depth ?? -1) + 1
            : 0;

        const originalDepth = root.depth;
        const delta = rootDepth - originalDepth;

        for (const group of subtree) {
            group.depth += delta;

            group.menuEntry.style.setProperty('--menu-indent', group.depth);
            group.menuEntry.classList.toggle('indent', group.depth > 0);
        }
    }

    #rebuildGroupDOM() {
        const GROUPS = [...this.#groups.values()]
            .sort((a, b) => b.parentId?.localeCompare(a.id));

        GROUPS.forEach((group, index, arr) => {
            const parent = arr.find(parent => parent.id === group.parentId);
            group.depth = (parent?.depth ?? -1) + 1;
        });

        const layoutManager = this.#report.getLayoutManager();
        layoutManager.organize(this.#groupOrder);

        for (const id of this.#groupOrder) {
            const group = this.#groups.get(id);
            if (!group) continue;

            const hasChildren = GROUPS.some(g => g.parentId === id);
            const { depth, menuEntry: entry} = group;

            entry.classList.toggle('collapsable', hasChildren);
            entry.classList.toggle('indent', depth);

            if (depth) entry.style.setProperty('--menu-indent', depth);
            else entry.style.removeProperty('--menu-indent');
        }
    }

    /**
     * Get group's index in group order
     * @param {string} groupId 
     * @returns {number}
     */
    getGroupIndex(groupId) {
        return this.#groupOrder?.indexOf(groupId) ?? -1;
    }

    /**
     * Get group from id
     * @param {string} groupId 
     * @returns {ReportGroup}
     */
    getGroup(groupId) {
        return this.#groups?.get(groupId);
    }

    /**
     * Get group from id
     * @param {string} groupId 
     * @returns {boolean}
     */
    hasGroup(groupId) {
        return this.#groups?.has(groupId);
    }

    /**
     * Get group from index.
     * A negative index will count back from the last item.
     * @param {number} index 
     * @returns {string}
     */
    getGroupId(index) {
        return this.#groupOrder?.at(index);
    }

    /**
     * Get size of group order
     * @returns {number}
     */
    getGroupOrderSize() {
        return this.#groupOrder?.length ?? 0;
    }

}
