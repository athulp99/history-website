const viewport = document.querySelector('.timeline-viewport');
const timeline = document.querySelector('#timeline');
const section = document.querySelector('.timeline-section');
const shell = document.querySelector('.page-shell');
const toolbar = document.querySelector('.timeline-controls');
const line = document.querySelector('.timeline-line');
const zoomInput = document.querySelector('#zoom-level');
const zoomText = document.querySelector('#zoom-text');
const zoomIn = document.querySelector('#zoom-in');
const zoomOut = document.querySelector('#zoom-out');
const earthAgeMyr = 4540;
const focusMyr = 0.001;
const padding = 28;
const labelGap = 16;
const rowGap = 24;
const lineGap = 40;
const svgNS = 'http://www.w3.org/2000/svg';
const connectors = document.createElementNS(svgNS, 'svg');
connectors.classList.add('timeline-connectors');
connectors.setAttribute('aria-hidden', 'true');
timeline.prepend(connectors);

let zoom = Number(zoomInput.value);
let frame = 0;
let geometry = null;
let drag = null;
const observedLabels = new Set();
const measuredSizes = new WeakMap();

function positionForAge(ageMyr) {
  const range = Math.log10(1 + earthAgeMyr / focusMyr);
  return 1 - Math.log10(1 + ageMyr / focusMyr) / range;
}

function rowsHeight(rows) {
  return rows.reduce((total, row) => total + row.height, 0) + Math.max(0, rows.length - 1) * rowGap;
}

// Use the nearest row with room, including labels clamped at an endpoint.
function candidate(rows, item) {
  let index = rows.findIndex(row => row.items.every(other =>
    item.left >= other.left + other.width + labelGap || other.left >= item.left + item.width + labelGap));
  if (index === -1) index = rows.length;
  const height = rowsHeight(rows) + (index === rows.length
    ? item.height + (rows.length ? rowGap : 0)
    : Math.max(0, item.height - rows[index].height));
  return { index, height };
}

function layout() {
  frame = 0;
  if (!viewport.clientWidth) return;
  // Use the old viewport width on resize, before replacing its geometry.
  const centre = geometry
    ? (viewport.scrollLeft + geometry.viewportWidth / 2 - padding) / geometry.span
    : .5;
  section.classList.add('is-ready');
  const viewportWidth = viewport.clientWidth;
  const width = viewportWidth * zoom;
  const span = Math.max(1, width - 2 * padding);
  timeline.style.width = width + 'px';
  const labels = Array.from(timeline.querySelectorAll('[data-age-myr]'))
    .sort((a, b) => Number(b.dataset.ageMyr) - Number(a.dataset.ageMyr));
  const activeLabels = new Set();
  const maxLabelWidth = Math.max(1, Math.min(240, viewportWidth - 2 * padding));

  // Set all width constraints before measuring wrapped text.
  labels.forEach(event => {
    const copy = event.querySelector('.event-copy');
    copy.style.maxWidth = maxLabelWidth + 'px';
    activeLabels.add(copy);
    if (!observedLabels.has(copy)) {
      labelObserver.observe(copy);
      observedLabels.add(copy);
    }
    if (!event.querySelector('.event-marker')) {
      const marker = document.createElement('div');
      marker.className = 'event-marker';
      marker.setAttribute('aria-hidden', 'true');
      event.prepend(marker);
    }
  });
  for (const copy of observedLabels) {
    if (!activeLabels.has(copy)) { labelObserver.unobserve(copy); observedLabels.delete(copy); }
  }
  const items = labels.map(event => {
    const copy = event.querySelector('.event-copy');
    const rect = copy.getBoundingClientRect();
    const x = padding + positionForAge(Number(event.dataset.ageMyr)) * span;
    const left = Math.max(padding, Math.min(width - padding - rect.width, x - rect.width / 2));
    return { event, copy, x, left, width: rect.width, height: rect.height };
  });

  const rows = { above: [], below: [] };
  items.forEach((item, index) => {
    const above = candidate(rows.above, item);
    const below = candidate(rows.below, item);
    const side = above.height < below.height ? 'above'
      : below.height < above.height ? 'below' : index % 2 === 0 ? 'below' : 'above';
    const chosen = side === 'above' ? above : below;
    if (!rows[side][chosen.index]) rows[side].push({ height: 0, items: [] });
    const row = rows[side][chosen.index];
    row.items.push(item);
    row.height = Math.max(row.height, item.height);
  });

  const extent = Math.max(rowsHeight(rows.above), rowsHeight(rows.below)) + lineGap + padding;
  const sectionStyle = getComputedStyle(section);
  const available = shell.clientHeight - toolbar.offsetHeight - parseFloat(sectionStyle.paddingBottom) - 16;
  const height = Math.ceil(Math.max(2 * extent, available));
  const axisY = height / 2;
  timeline.style.height = height + 'px';
  Object.assign(line.style, { left: padding + 'px', width: span + 'px', top: axisY + 'px' });
  connectors.setAttribute('width', width);
  connectors.setAttribute('height', height);
  const paths = [];
  for (const side of ['above', 'below']) {
    let distance = lineGap;
    for (const row of rows[side]) {
      for (const item of row.items) {
        const top = side === 'above' ? axisY - distance - item.height : axisY + distance;
        Object.assign(item.event.style, { left: item.x + 'px', top: axisY + 'px' });
        Object.assign(item.copy.style, {
          left: (item.left - item.x) + 'px', top: (top - axisY) + 'px',
          textAlign: item.x <= padding ? 'left' : item.x >= width - padding ? 'right' : 'center'
        });
        const endX = Math.max(item.left + 8, Math.min(item.left + item.width - 8, item.x));
        const endY = side === 'above' ? top + item.height + 4 : top - 4;
        const startY = axisY + (side === 'above' ? -10 : 10);
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', 'M ' + item.x + ' ' + startY + ' L ' + item.x + ' ' + endY + ' L ' + endX + ' ' + endY);
        path.setAttribute('stroke', getComputedStyle(item.event).getPropertyValue('--event-color').trim());
        paths.push(path);
      }
      distance += row.height + rowGap;
    }
  }
  connectors.replaceChildren(...paths);
  geometry = { span, viewportWidth };
  viewport.scrollLeft = padding + centre * span - viewportWidth / 2;
}

function scheduleLayout() {
  if (!frame) frame = requestAnimationFrame(layout);
}

const labelObserver = new ResizeObserver(entries => {
  let changed = false;
  for (const entry of entries) {
    const size = entry.contentRect.width + ',' + entry.contentRect.height;
    if (measuredSizes.get(entry.target) !== size) {
      measuredSizes.set(entry.target, size);
      changed = true;
    }
  }
  if (changed) scheduleLayout();
});
const containerObserver = new ResizeObserver(entries => {
  for (const entry of entries) {
    // Ignore canvas-driven viewport height changes to avoid a feedback loop.
    const size = entry.target === viewport ? String(entry.contentRect.width)
      : entry.contentRect.width + ',' + entry.contentRect.height;
    if (measuredSizes.get(entry.target) !== size) {
      measuredSizes.set(entry.target, size);
      scheduleLayout();
    }
  }
});
containerObserver.observe(viewport);
containerObserver.observe(shell);
containerObserver.observe(toolbar);
new MutationObserver(records => {
  if (records.some(record => !connectors.contains(record.target))) scheduleLayout();
}).observe(timeline, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-age-myr'] });
document.fonts.ready.then(scheduleLayout);
document.fonts.addEventListener('loadingdone', scheduleLayout);

function setZoom(nextZoom) {
  zoom = Math.min(Number(zoomInput.max), Math.max(Number(zoomInput.min), nextZoom));
  zoomInput.value = zoom;
  zoomText.textContent = zoom + '×';
  zoomIn.disabled = zoom === Number(zoomInput.max);
  zoomOut.disabled = zoom === Number(zoomInput.min);
  scheduleLayout();
}
zoomIn.addEventListener('click', () => setZoom(zoom + 1));
zoomOut.addEventListener('click', () => setZoom(zoom - 1));
zoomInput.addEventListener('input', event => setZoom(Number(event.target.value)));
viewport.addEventListener('pointerdown', event => {
  if (event.pointerType === 'touch' || event.button !== 0) return;
  drag = { x: event.clientX, scroll: viewport.scrollLeft };
  viewport.classList.add('is-dragging');
  viewport.setPointerCapture(event.pointerId);
});
viewport.addEventListener('pointermove', event => {
  if (drag) viewport.scrollLeft = drag.scroll - (event.clientX - drag.x);
});
function stopDragging(event) {
  drag = null;
  viewport.classList.remove('is-dragging');
  if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
}
viewport.addEventListener('pointerup', stopDragging);
viewport.addEventListener('pointercancel', stopDragging);
viewport.addEventListener('lostpointercapture', () => { drag = null; viewport.classList.remove('is-dragging'); });
viewport.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    viewport.scrollLeft += (event.key === 'ArrowRight' ? 1 : -1) * Math.max(48, viewport.clientWidth / 5);
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    viewport.scrollLeft = event.key === 'Home' ? 0 : timeline.clientWidth;
  }
});
viewport.addEventListener('wheel', event => {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  setZoom(zoom + (event.deltaY < 0 ? 1 : -1));
}, { passive: false });
setZoom(zoom);
