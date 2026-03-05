
/**
 * @param { DragEvent } event 
 */
function dragStartListener(event) {
    /** @type { Element | null } */
    const element = event.target;
    if (element == null) return;

    /** @type {DOMTokenList} */
    const classes = element.classList;
    if (!classes.contains('draggable')) return;

    classes.add('is-dragging');
    document.body.classList.add('mask-dragging');
}

/**
 * @param { DragEvent } event 
 */
function dragEndListener(event) {
    /** @type { Element | null } */
    const element = event.target;
    if (element == null) return;

    /** @type {DOMTokenList} */
    const classes = element.classList;
    if (!classes.contains('draggable')) return;

    classes.remove('is-dragging');
    document.body.classList.remove('mask-dragging');
}

/**
 * @param { DragEvent } event 
 */
function dragOverListener(event) {
    // Let's hide the drag animation
    event.preventDefault()

    /** @type { Element } */
    let parent = event.target;
    if (parent == null) return;
    
    /** @type { Element } */
    const element = document.querySelector('.b-container .draggable.is-dragging');
    if (element == null) return;

    if (!parent.classList.contains('b-container'))
        // This must be a sibling element
        if (parent.classList.contains('draggable'))
            parent = parent.parentElement;
    
    // Let's recheck if the parent is a container
    if (!parent.classList.contains('b-container')) return;
    
    const draggableElements = [...parent.querySelectorAll(':scope > .draggable')];

    const afterElement = draggableElements.reduce((closest, child) => {
        if (child.classList.contains('is-dragging'))
            return closest;

        const box = child.getBoundingClientRect();
        const offset = event.clientY - box.top - box.height/2;
        if (offset < 0 && offset > closest.offset)
            return { offset, element: child };
        else return closest;
    }, { offset: Number.NEGATIVE_INFINITY })?.element;

    const selfIndex = draggableElements.indexOf(element),
        afterElementIndex = draggableElements.indexOf(afterElement);

    const isInParent = selfIndex >= 0;
    const isBeforeAnElement = afterElementIndex >= 0;
    const elementPosition = (isBeforeAnElement ? afterElementIndex : draggableElements.length) - 1;
    const shouldUpdate = !isInParent || selfIndex != elementPosition;

    if (shouldUpdate) {
        if (afterElement) parent.insertBefore(element, afterElement);
        else parent.appendChild(element);
    }
}

document.addEventListener('dragstart', dragStartListener);
document.addEventListener('dragend', dragEndListener);
document.addEventListener('dragover', dragOverListener);
