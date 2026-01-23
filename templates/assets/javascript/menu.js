
/**
 * @param { PointerEvent } event 
 */
function clickListener(event) {
    /** @type { Element } */
    let element = event.target;
    if (element == null) return;

    if (element.classList.contains('desc'))
        element = element.parentElement;

    if (!element.classList.contains('menu-entry'))
        return;

    if (element.classList.contains('collapsed'))
        element.classList.remove('collapsed');
    else element.classList.add('collapsed');

    console.log(element);
}

document.addEventListener('click', clickListener);
