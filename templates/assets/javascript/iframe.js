
export class FrameHandler {

    static #observer = new ResizeObserver((entries, observer) => {
        /** @type { HTMLIFrameElement } */
        const frame = entries[0].target;
        FrameHandler.#resizeFrame(frame);
    });

    /**
     * @param {HTMLIFrameElement} frame 
     */
    static handle(frame) {
        if (frame.nodeName.toLowerCase() !== 'iframe')
            throw new Error('FrameHandler only accepts iframe elements');
    
        FrameHandler.#observer.observe(frame, { box: "content-box" });
        frame.addEventListener('load', (ev) => FrameHandler.#resizeFrame(frame));
    }

    /**
     * @param {HTMLIFrameElement} frame 
     */
    static #resizeFrame(frame) {
        const innerContent = frame?.contentDocument || frame?.contentWindow?.document;
        const frameBody = innerContent?.body;

        if (frameBody == null) return;
        var targetHeight = (frameBody.clientHeight + 30) + 'px';
        if (frame.height != targetHeight) frame.height = targetHeight;
    }

}
