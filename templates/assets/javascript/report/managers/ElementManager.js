import { ElementFactory } from "../factories/ElementFactory.js";
import { ReportElement } from "../models/ReportElement.js";
import { ReportBuilder } from "../ReportBuilder.js";
import { iterateGroups } from "../utils/groupTree.js";

export class ElementManager {

    /** @type {ElementFactory} */
    #elementFactory;

    /** @type {Map<string, ReportElement>} */
    #elements = new Map();

    /** @type {ReportBuilder} */
    #report;

    /**
     * @param {ReportBuilder} report
     */
    constructor(report) {
        this.#report = report;
        this.#elementFactory = new ElementFactory(report);
    }

    /**
     * @param {string} groupId
     * @param {Object} options
     */
    addElementToGroup(groupId, options) {
        return this.insertElementIntoGroup(groupId, options, null, false);
    }

    /**
     * @param {string} groupId
     * @param {Object} options
     * @param {number} [index]
     */
    insertElementIntoGroup(groupId, options, index = null, edit = false) {
        const groupManager = this.#report.getGroupManager();
        const group = groupManager.getGroup(groupId);
        if (!group) return null;


        const element = this.#elementFactory.createElementFromType(options, edit);
        if (!element) return null;

        if (index == null) index = group.elements.length;

        group.elements.splice(index, 0, element);
        this.#elements.set(element.id, element);
        this.#attachElementEvents(element, groupId);

        const beforeNode = group.content.children[index];
        if (beforeNode) group.content.insertBefore(element.node, beforeNode);
        else group.content.appendChild(element.node);

        return element;
    }
    
    /**
     * @param {string} elementId
     * @param {string} sourceGroupId
     * @param {string} targetGroupId
     * @param {number} targetIndex
     */
    moveElementToGroup(elementId, sourceGroupId, targetGroupId, targetIndex = 0) {
        const groupManager = this.#report.getGroupManager();
        const sourceGroup = groupManager.getGroup(sourceGroupId);
        const targetGroup = groupManager.getGroup(targetGroupId);
        const element = this.#elements.get(elementId);

        if (!sourceGroup || !targetGroup || !element) return;

        const sourceIndex = sourceGroup.elements.findIndex(
            el => el.id === elementId
        );

        if (sourceIndex === -1) return;
        sourceGroup.elements.splice(sourceIndex, 1);

        if (sourceGroupId === targetGroupId) 
            if (sourceIndex < targetIndex)
                targetIndex--;

        targetGroup.elements.splice(targetIndex, 0, element);

        const children = [...targetGroup.content.querySelectorAll('.b-element')];

        const beforeNode = children[targetIndex];
        if (beforeNode) targetGroup.content.insertBefore(element.node, beforeNode);
        else targetGroup.content.appendChild(element.node);

        this.#attachElementEvents(element, targetGroupId);
    }

    /**
     * @param {ReportElement} element 
     * @param {string} groupId 
     */
    #attachElementEvents({ node: element, id: elementId }, groupId) {
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

    toJSON() {
        const project = this.#report.getProjectId();
        const groups = [];

        iterateGroups(this.#report.getGroupManager(), 0, ({id, title, elements}) => {
            groups.push({
                identifier: id,
                title: title,
                elements: elements.map(({ id: identifier, type, data }) => ({ identifier, type, data }))
            });
        });

        return { project, groups };
    }

}
