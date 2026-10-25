const viewport = document.querySelector('.timeline-viewport');
const timeline = document.querySelector('#timeline');
const zoomInput = document.querySelector('#zoom-level');
const zoomText = document.querySelector('#zoom-text');
const zoomIn = document.querySelector('#zoom-in');
const zoomOut = document.querySelector('#zoom-out');

let zoom = Number(zoomInput.value);
let dragStartX = 0;
let dragStartScroll = 0;
let isDragging = false;

function baseZoom() {
  return window.matchMedia('(max-width: 620px)').matches ? 3 : 1;
}

function setZoom(nextZoom, keepCentre = true) {
  const previousCentre = viewport.scrollLeft + viewport.clientWidth / 2;
  const previousWidth = timeline.clientWidth || viewport.clientWidth;
  zoom = Math.min(Number(zoomInput.max), Math.max(Number(zoomInput.min), nextZoom));
  timeline.style.width = `${zoom * baseZoom() * 100}%`;
  zoomInput.value = zoom;
  zoomText.textContent = `${zoom}×`;
  zoomIn.disabled = zoom === Number(zoomInput.max);
  zoomOut.disabled = zoom === Number(zoomInput.min);
  if (keepCentre) requestAnimationFrame(() => {
    viewport.scrollLeft = (previousCentre / previousWidth) * timeline.clientWidth - viewport.clientWidth / 2;
  });
}

zoomIn.addEventListener('click', () => setZoom(zoom + 1));
zoomOut.addEventListener('click', () => setZoom(zoom - 1));
zoomInput.addEventListener('input', (event) => setZoom(Number(event.target.value)));
viewport.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch') return;
  isDragging = true; dragStartX = event.clientX; dragStartScroll = viewport.scrollLeft;
  viewport.classList.add('is-dragging'); viewport.setPointerCapture(event.pointerId);
});
viewport.addEventListener('pointermove', (event) => {
  if (isDragging) viewport.scrollLeft = dragStartScroll - (event.clientX - dragStartX);
});
function stopDragging(event) {
  if (!isDragging) return;
  isDragging = false; viewport.classList.remove('is-dragging');
  if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
}
viewport.addEventListener('pointerup', stopDragging);
viewport.addEventListener('pointercancel', stopDragging);
viewport.addEventListener('wheel', (event) => {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault(); setZoom(zoom + (event.deltaY < 0 ? 1 : -1));
}, { passive: false });
window.addEventListener('resize', () => setZoom(zoom, false));
setZoom(zoom, false);
