const observer = new ResizeObserver((entries, _observer) => {
  /** @type { HTMLIFrameElement } */
  const frame = entries[0].target;
  resizeFrame(frame);
});

export function handle(frame) {
  if (frame.nodeName.toLowerCase() !== 'iframe')
    throw new Error('FrameHandler only accepts iframe elements');

  observer.observe(frame, { box: 'content-box' });
  frame.addEventListener('load', (_ev) => resizeFrame(frame));
}

function resizeFrame(frame) {
  const innerContent = frame?.contentDocument || frame?.contentWindow?.document;
  const frameBody = innerContent?.body;

  if (frameBody == null) return;
  var targetHeight = `${frameBody.clientHeight + 30}px`;
  if (frame.height !== targetHeight) frame.height = targetHeight;
}
