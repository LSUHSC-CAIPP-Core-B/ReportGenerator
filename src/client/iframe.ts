const observer = new ResizeObserver((entries, _observer) => {
  const frame = entries[0].target as HTMLIFrameElement;
  resizeFrame(frame);
});

export function handle(frame: HTMLElement) {
  if (frame.nodeName.toLowerCase() !== 'iframe')
    throw new Error('FrameHandler only accepts iframe elements');

  observer.observe(frame, { box: 'content-box' });
  frame.addEventListener('load', (_ev) => resizeFrame(frame as HTMLIFrameElement));
}

function resizeFrame(frame: HTMLIFrameElement) {
  const innerContent = frame?.contentDocument || frame?.contentWindow?.document;
  const frameBody = innerContent?.body;

  if (frameBody == null) return;
  const targetHeight = `${frameBody.clientHeight + 30}px`;
  if (frame.height !== targetHeight) frame.height = targetHeight;
}
