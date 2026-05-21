import { ReportBuilder } from "../ReportBuilder.js";
import { isDescendant } from "../utils/groupTree.js";

export class DragDropManager {

    /** @type {number} */
    #insertIndex = null;

    /** @type {ReportBuilder} */
    #report;

    /**
     * @param {ReportBuilder} report
     */
    constructor(report) {
        this.#report = report;
    }

    /**
     * @param {string} groupId 
     */
    attachGroupEvents(groupId) {
        const groupManager = this.#report.getGroupManager();
        const insertManager = this.#report.getPendingInsertManager();
        const elementManager = this.#report.getElementManager();
        const { menuEntry: entry, content, id } = groupManager.getGroup(groupId);

        entry.addEventListener('dragstart', event => {
            event.dataTransfer.setData('text/group-id', id);
        });

        entry.addEventListener('dragover', event => {
            event.preventDefault();
            content.classList.add('drag-hover');
        });

        content.addEventListener('dragover', event => {
            event.preventDefault();

            const elementId = event.dataTransfer.getData('text/element-id');
            if (!elementId) return;

            const children = [ ...content.querySelectorAll('.b-element')];
            this.#insertIndex = children.length;

            for (let i = 0; i < children.length; i++) {
                const child = children[i];

                if (child.getAttribute('aria-identifier') === elementId)
                    continue;

                const rect = child.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;

                if (event.clientY < midpoint) {
                    this.#insertIndex = i;
                    break;
                }
            }

            insertManager.setInsertMarker(id, this.#insertIndex);
        });


        entry.addEventListener('dragleave', (event) => {
            if (!content.contains(event.relatedTarget))
                insertManager.removeInsertMarker();
        });

        entry.addEventListener('drop', event => {
            event.preventDefault();
            content.classList.remove('drag-hover');

            const elementId = event.dataTransfer.getData('text/element-id');
            const sourceGroupId = event.dataTransfer.getData('text/source-group-id');

            if (elementId && sourceGroupId) {
                const targetGroupId = groupId;
                const insertIndex = this.#insertIndex ?? 0;

                elementManager.moveElementToGroup(elementId, sourceGroupId, targetGroupId, insertIndex);
                insertManager.removeInsertMarker();
                return;
            }

            const targetId = groupId;
            const sourceId = event.dataTransfer.getData('text/group-id');
            if (!sourceId || sourceId === targetId) return;
            if (isDescendant(groupManager, sourceId, targetId)) return;

            const rect = entry.getBoundingClientRect();
            const offsetY = event.clientY - rect.top;
            const ratio = offsetY / rect.height;

            const position = (ratio < 0.25) ? 'before'
                : (ratio > 0.75) ? 'after'
                : 'inside';

            groupManager.moveGroup(sourceId, targetId, position);
        });

        content.addEventListener('drop', event => {
            event.preventDefault();

            const elementId = event.dataTransfer.getData('text/element-id');
            const sourceGroupId = event.dataTransfer.getData('text/source-group-id');
            if (!elementId || !sourceGroupId) return;

            const targetGroupId = groupId;
            const insertIndex = this.#insertIndex ?? 0;
            elementManager.moveElementToGroup(elementId, sourceGroupId, targetGroupId, insertIndex);

            insertManager.removeInsertMarker();
        });
    }

    /**
     * @param {string} elementId 
     * @param {string} groupId 
     */
    attachElementEvents(elementId, groupId) {
        const elementManager = this.#report.getElementManager();
        const { node: element } = elementManager.get(elementId);

        element.addEventListener('dragstart', event => {
            element.classList.add('dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/element-id', elementId);
            event.dataTransfer.setData('text/source-group-id', groupId);
        });

        element.addEventListener('dragend', () => {
            element.classList.remove('dragging');
            // insertManager.removeInsertMarker();
        });
    }

}
