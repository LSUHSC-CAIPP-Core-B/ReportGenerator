import { ElementManager } from "../managers/ElementManager.js";

export class ElementRenderer {

    /** @type {ElementManager} */
    #manager;

    /**
     * @param {ElementManager} manager 
     */
    constructor(manager) {
        this.#manager = manager;
    }

    /**
     * @param {string} elementId 
     * @param {boolean} force 
     */
    toggleDragEffect(elementId, force = null) {
        const element = this.#manager.getElement(elementId);
        if (!element) return;

        const { node } = element;
        if (force === null) force = !node.classList.contains('dragging');
        node.classList.toggle('dragging', force);
    }

    /**
     * @param {string} elementId 
     * @param {boolean} force 
     */
    toggleInsertionOverlay(elementId, force = null) {
        const element = this.#manager.getElement(elementId);
        if (!element) return;

        const { node } = element;
        if (force === null) force = !node.classList.contains('hovering');
        node.classList.toggle('hovering', force);
    }

    /**
     * @param {boolean} force 
     */
    toggleOverlay(force) {
        this.#manager.iterateElements(({ node: element }) => {
            element.classList.toggle('collapsed', force);
        });
    }

    changeGhost(event) {
        element.addEventListener("dragstart", (e) => {
        const ghost = element.cloneNode(true);

        // optional: style it smaller
        ghost.style.width = "100px";
        ghost.style.transform = "scale(0.5)";
        ghost.style.position = "absolute";
        ghost.style.top = "-9999px";

        document.body.appendChild(ghost);

        e.dataTransfer.setDragImage(ghost, 10, 10);

        setTimeout(() => document.body.removeChild(ghost), 0);
        });
    }

}
