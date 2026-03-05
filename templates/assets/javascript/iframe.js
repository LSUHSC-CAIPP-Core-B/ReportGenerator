
/**
 * @param {HTMLIFrameElement} frame 
 */
function resizeFrame(frame) {
    const innerContent = frame?.contentDocument || frame?.contentWindow?.document;
    const frameBody = innerContent?.body;

    if (frameBody == null) return;
    var targetHeight = (frameBody.clientHeight + 30) + 'px';
    if (frame.height != targetHeight) frame.height = targetHeight;
}

/**
 * @this { HTMLIFrameElement } the document
 * @param { Event } ev the event
 * @returns { void }
 */
function frameLoadListener(ev) {
    resizeFrame(this);
}

const p$ = new ResizeObserver((entries, observer) => {
    /** @type { HTMLIFrameElement } */
    const frame = entries[0].target;
    resizeFrame(frame);
});


/** @type {HTMLIFrameElement[]} */
const frameElements = [...document.querySelectorAll(".b-frame iframe.frame")];

for (const frameElement of frameElements) {
    p$.observe(frameElement, { box: "content-box" });
    frameElement.addEventListener('load', frameLoadListener);
}


