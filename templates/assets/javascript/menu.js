
/**
 * @param { PointerEvent } event 
 */
function clickListener(event) {
    /** @type { Element } */
    let element = event.target;
    if (element == null) return;

    if (!element.classList.contains('menu-entry')) return;
    if (!element.classList.contains('collapsable')) return;

    let siblings = [...element.parentElement.children];
    const elementIndex = siblings.indexOf(element);
    let keepHiddenAt = Number.POSITIVE_INFINITY;
    let elementIndent = 0;
    let lastHasIndex = true;
    
    try {
        const computedStyle = window.getComputedStyle(element);
        const indentStr = computedStyle.getPropertyValue('--menu-indent');
        elementIndent = parseInt(indentStr, 10) || 0;
    } catch (e) {
        console.error(e);
    }

    siblings = siblings.filter((sibling, index, arr) => {
        if (index <= elementIndex) return false;
        if (!lastHasIndex) return false;

        try {
            const computedStyle = window.getComputedStyle(sibling);
            const indentStr = computedStyle.getPropertyValue('--menu-indent');
            let currentIndent = parseInt(indentStr, 10) || 0;
            if (currentIndent <= elementIndent) lastHasIndex = false;
            
            if (currentIndent > keepHiddenAt) return false;
            else if (sibling.classList.contains('collapsed')) keepHiddenAt = currentIndent;
            else if (currentIndent == keepHiddenAt) keepHiddenAt = Number.POSITIVE_INFINITY;

        } catch (ignored) {
            lastHasIndex = false;
        }
        
        return lastHasIndex;
    });

    if (element.classList.contains('collapsed')) {
        element.classList.remove('collapsed');

        for (const sibling of siblings)
            sibling.classList.remove('hidden');
    } else {
        element.classList.add('collapsed');

        for (const sibling of siblings)
            sibling.classList.add('hidden');
    }

    console.log(element);
}

/**
 * @param { Event } event
 */
function scrollListener(event) {
    const navbar = document.querySelector('.b-navbar');
    if (navbar != null) navbar.classList.toggle('scrolled', window.scrollY > 0);
}

/**
 * @param { Event } event
 */
function loadListener(event) {
    const stickyElements = document.querySelectorAll('.js-sticky');
    const verticalScroll = window.scrollY;

    for (const element of stickyElements) {
        if (!(element instanceof HTMLElement)) continue;

        const style = window.getComputedStyle(element);
        if (style.position != 'sticky') element.style.position = 'sticky';

        const parent = element.parentElement;
        const parentStyle = window.getComputedStyle(parent);
        const parentBorder = parent.getBoundingClientRect();

        const topPadding = parseInt(parentStyle.paddingTop, 10) || 0;
        
        const parentStartY = (parentBorder.y + verticalScroll) + topPadding;
        element.style.top = parentStartY + 'px';
    }
}

document.addEventListener('click', clickListener);
document.addEventListener('scroll', scrollListener);
// document.addEventListener('DOMContentLoaded', loadListener);
