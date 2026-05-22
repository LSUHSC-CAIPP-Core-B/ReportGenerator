import { ElementFactory } from "../factories/ElementFactory.js";
import { ReportElement } from "../models/ReportElement.js";
import { ElementRenderer } from "../renderers/ElementRenderer.js";
import { ReportBuilder } from "../ReportBuilder.js";
import { iterateGroups } from "../utils/groupTree.js";

export class ElementManager {

    /** @type {ElementFactory} */
    #elementFactory;

    /** @type {Map<string, ReportElement>} */
    #elements = new Map();

    /** @type {ReportBuilder} */
    #report;
    /** @type {ElementRenderer} */
    #renderer;

    /**
     * @param {ReportBuilder} report
     */
    constructor(report) {
        this.#report = report;
        this.#elementFactory = new ElementFactory(report);
        this.#renderer = new ElementRenderer(this);
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
        const dragDropManager = this.#report.getDragDropManager();

        const group = groupManager.getGroup(groupId);
        if (!group) return null;

        const element = this.#elementFactory.createElementFromType(options, edit);
        if (!element) return null;
        const { identifier } = element;

        if (index == null) index = group.elements.length;

        group.elements.splice(index, 0, element);
        this.#elements.set(identifier, element);
        dragDropManager.attachElementEvents(identifier);

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
        const dragDropManager = this.#report.getDragDropManager();

        const sourceGroup = groupManager.getGroup(sourceGroupId);
        const targetGroup = groupManager.getGroup(targetGroupId);

        if (!sourceGroup || !targetGroup) return;
        const sourceIndex = sourceGroup.elements.findIndex(
            ({identifier}) => identifier === elementId
        );

        if (sourceGroupId === targetGroupId)
            if (sourceIndex === targetIndex) return;
            else if (sourceIndex < targetIndex)
                targetIndex--;
        
        /** @type {ReportElement} */
        const element = sourceGroup.elements.splice(sourceIndex, 1)[0];
        /** @type {ReportElement} */
        const target = targetGroup.elements.slice(targetIndex)[0];
        targetGroup.elements.splice(targetIndex, 0, element);
        
        if (target) targetGroup.content.insertBefore(element.node, target.node);
        else targetGroup.content.appendChild(element.node);
    }

    /**
     * Get element from id
     * @param {string} elementId 
     * @returns {ReportElement}
     */
    getElement(elementId) {
        return this.#elements?.get(elementId);
    }

    /**
     * Check if element exists from id
     * @param {string} elementId 
     * @returns {boolean}
     */
    hasElement(elementId) {
        return this.#elements?.has(elementId);
    }

    /**
     * @param {(element: ReportElement) => void} callback
     */
    iterateElements(callback) {
        for (const element of this.#elements.values())
            callback(element);
    }

    toJSON() {
        const project = this.#report.getProjectId();
        const groups = [];

        iterateGroups(this.#report.getGroupManager(), 0, (group) => groups.push(group));

        return { project, groups };
    }

    getRenderer() {
        return this.#renderer;
    }

}
