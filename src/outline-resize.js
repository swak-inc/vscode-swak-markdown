const defaultWidth = 220, minWidth = 180, maxWidth = 480, minContentWidth = 360;

export function createOutlineResize({ layout, sidebar, narrow, onResize }) {
  const handle = document.getElementById('outline-resize');
  let preferredWidth = defaultWidth, width = defaultWidth, drag = null;

  function limit() {
    return Math.max(minWidth, Math.min(maxWidth, Math.floor(layout.getBoundingClientRect().width - minContentWidth)));
  }
  function render() {
    const maximum = limit();
    width = Math.max(minWidth, Math.min(preferredWidth, maximum));
    layout.style.setProperty('--outline-width', `${width}px`);
    handle.setAttribute('aria-valuemin', minWidth);
    handle.setAttribute('aria-valuemax', maximum);
    handle.setAttribute('aria-valuenow', width);
    handle.setAttribute('aria-valuetext', `目次の幅 ${width}px`);
    onResize();
  }
  function setWidth(value) {
    preferredWidth = Math.round(Math.max(minWidth, Math.min(value, limit())));
    render();
  }
  function finish(cancel = false) {
    if (!drag) return;
    const previous = drag;
    drag = null;
    document.body.classList.remove('outline-resizing');
    if (handle.hasPointerCapture(previous.id)) handle.releasePointerCapture(previous.id);
    if (cancel) { preferredWidth = previous.preferredWidth; render(); }
  }
  function refresh() {
    handle.hidden = narrow.matches || sidebar.hidden;
    if (handle.hidden) finish();
    render();
  }
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || handle.hidden) return;
    event.preventDefault();
    handle.focus({ preventScroll: true });
    drag = { id: event.pointerId, x: event.clientX, width, preferredWidth };
    handle.setPointerCapture(event.pointerId);
    document.body.classList.add('outline-resizing');
  });
  handle.addEventListener('pointermove', event => {
    if (drag?.id === event.pointerId) setWidth(drag.width + drag.x - event.clientX);
  });
  handle.addEventListener('pointerup', event => { if (drag?.id === event.pointerId) finish(); });
  handle.addEventListener('pointercancel', event => { if (drag?.id === event.pointerId) finish(true); });
  handle.addEventListener('lostpointercapture', () => finish());
  handle.addEventListener('dblclick', () => setWidth(defaultWidth));
  handle.addEventListener('keydown', event => {
    const step = event.shiftKey ? 50 : 10;
    if (event.key === 'ArrowLeft') setWidth(width + step);
    else if (event.key === 'ArrowRight') setWidth(width - step);
    else if (event.key === 'Home') setWidth(minWidth);
    else if (event.key === 'End') setWidth(limit());
    else if (event.key === 'Enter') setWidth(defaultWidth);
    else if (event.key === 'Escape' && drag) finish(true);
    else return;
    event.preventDefault();
  });
  window.addEventListener('blur', () => finish(true));
  new ResizeObserver(refresh).observe(layout);
  return { refresh };
}
