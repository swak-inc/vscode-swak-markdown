import { createOutlineResize } from './outline-resize.js';

const headingSelector = 'h1, h2, h3, h4, h5, h6';

export function createOutline({ getRoot, onNavigate }) {
  const layout = document.getElementById('document-layout');
  const sidebar = document.getElementById('outline');
  const list = document.getElementById('outline-list');
  const empty = document.getElementById('outline-empty');
  const toggle = document.getElementById('outline-toggle');
  const expandAll = document.getElementById('outline-expand-all');
  const collapseAll = document.getElementById('outline-collapse-all');
  const toolbar = document.getElementById('toolbar');
  const narrow = matchMedia('(max-width: 800px)');
  let desktopOpen = true, mobileOpen = false, headings = [], entries = [], signature = '', active = -1;
  let hoveredEntry = null;
  let refreshFrame = 0, scrollFrame = 0;
  const resize = createOutlineResize({ layout, sidebar, narrow, onResize: scheduleCurrent });

  function updateVisibility() {
    const open = narrow.matches ? mobileOpen : desktopOpen;
    sidebar.hidden = !open;
    layout.classList.toggle('outline-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.classList.toggle('selected', open);
    resize.refresh();
    scheduleCurrent();
  }
  function setOpen(open) {
    if (narrow.matches) mobileOpen = open;
    else desktopOpen = open;
    updateVisibility();
  }
  function visibleEntry(entry) {
    let visible = entry;
    for (let parent = entry?.parent; parent; parent = parent.parent) {
      if (parent.collapsed) visible = parent;
    }
    return visible;
  }
  function updateGuide() {
    entries.forEach(entry => entry.children?.classList.remove('outline-branch-active'));
    const focused = entries.find(entry => entry.row.contains(document.activeElement));
    const entry = visibleEntry(hoveredEntry || focused || entries[active]);
    // 展開中の親は自身の配下、末端・閉じた親は直近の親階層の線を強調する。
    const branch = entry?.children && !entry.collapsed ? entry : entry?.parent;
    branch?.children.classList.add('outline-branch-active');
  }
  function updateCurrent() {
    scrollFrame = 0;
    // scrollIntoViewとsticky領域のサブピクセル丸めを吸収する。
    const threshold = toolbar.getBoundingClientRect().bottom + 28;
    let next = -1;
    for (let index = 0; index < headings.length; index++) {
      const heading = headings[index];
      if (!heading.getClientRects().length) continue;
      if (next < 0) next = index;
      if (heading.getBoundingClientRect().top <= threshold) next = index;
      else break;
    }
    if (next === active) return;
    active = next;
    entries.forEach((entry, index) => {
      if (index === active) entry.link.setAttribute('aria-current', 'location');
      else entry.link.removeAttribute('aria-current');
      entry.row.classList.remove('outline-current-parent');
    });
    const visible = visibleEntry(entries[active]);
    if (visible && visible !== entries[active]) visible.row.classList.add('outline-current-parent');
    updateGuide();
    const button = visible?.link;
    if (button && !sidebar.hidden) {
      const bounds = button.getBoundingClientRect(), viewport = list.getBoundingClientRect();
      if (bounds.top < viewport.top) list.scrollTop += bounds.top - viewport.top;
      else if (bounds.bottom > viewport.bottom) list.scrollTop += bounds.bottom - viewport.bottom;
    }
  }
  function scheduleCurrent() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateCurrent);
  }
  function expandAncestors(heading) {
    for (let parent = heading.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parent.open = true;
      if (parent.classList.contains('callout-content') && parent.hidden) {
        parent.previousElementSibling?.querySelector('.swak-fold')?.click();
      }
    }
  }
  function navigate(index) {
    const heading = headings[index];
    if (!heading) return;
    expandAncestors(heading);
    onNavigate(heading);
    heading.scrollIntoView({ block: 'start', behavior: 'instant' });
    if (narrow.matches) setOpen(false);
    scheduleCurrent();
  }
  function updateFold(entry) {
    if (!entry.children) return;
    entry.children.hidden = entry.collapsed;
    entry.toggle.setAttribute('aria-expanded', String(!entry.collapsed));
    const label = `${entry.title}を${entry.collapsed ? '展開' : '折りたたむ'}`;
    entry.toggle.setAttribute('aria-label', label);
    entry.toggle.title = label;
  }
  function updateFoldControls() {
    const branches = entries.filter(entry => entry.children);
    expandAll.disabled = !branches.some(entry => entry.collapsed);
    collapseAll.disabled = !branches.some(entry => !entry.collapsed);
    active = -1;
    scheduleCurrent();
  }
  function setAllCollapsed(collapsed) {
    entries.forEach(entry => { entry.collapsed = collapsed; updateFold(entry); });
    updateFoldControls();
  }
  function refresh() {
    if (refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      headings = [...(getRoot()?.querySelectorAll(headingSelector) || [])];
      const nextSignature = JSON.stringify(headings.map(heading => [heading.tagName, heading.textContent]));
      if (nextSignature !== signature) {
        signature = nextSignature;
        active = -1;
        hoveredEntry = null;
        const previous = entries;
        const byHeading = new Map(previous.map(entry => [entry.heading, entry]));
        const retained = new Set(headings), used = new Set();
        const fragment = document.createDocumentFragment();
        const parents = [];
        entries = headings.map((heading, index) => {
          const level = Number(heading.tagName.slice(1));
          const title = heading.textContent.trim() || '無題の見出し';
          // 同じDOMを優先し、表示切替時は見出し名・出現順で開閉状態を引き継ぐ。
          let prior = byHeading.get(heading) || previous.find(entry => !used.has(entry) && !retained.has(entry.heading) && entry.level === level && entry.title === title);
          if (!prior && previous.length === headings.length && !used.has(previous[index]) && !retained.has(previous[index].heading)) prior = previous[index];
          if (prior) used.add(prior);
          while (parents.length && parents.at(-1).level >= level) parents.pop();
          const parent = parents.at(-1);
          // 見出しレベルが飛んでも、直前の上位見出しの子としてまとめる。
          const container = parent
            ? (parent.children ||= parent.item.appendChild(document.createElement('ol')))
            : fragment;
          const item = document.createElement('li');
          const row = item.appendChild(document.createElement('div'));
          row.className = 'outline-row';
          const disclosure = row.appendChild(document.createElement('button'));
          disclosure.type = 'button'; disclosure.className = 'outline-chevron'; disclosure.hidden = true;
          const link = row.appendChild(document.createElement('button'));
          link.type = 'button'; link.className = 'outline-link'; link.textContent = title; link.title = title;
          link.addEventListener('click', () => navigate(index));
          const entry = { level, title, heading, item, row, link, toggle: disclosure, parent, collapsed: prior?.collapsed || false };
          row.addEventListener('mouseenter', () => { hoveredEntry = entry; updateGuide(); });
          row.addEventListener('mouseleave', () => { hoveredEntry = null; updateGuide(); });
          disclosure.addEventListener('click', () => {
            entry.collapsed = !entry.collapsed;
            updateFold(entry); updateFoldControls();
          });
          container.appendChild(item);
          parents.push(entry);
          return entry;
        });
        entries.forEach((entry, index) => {
          if (!entry.children) return;
          entry.children.id = `outline-children-${index}`;
          entry.toggle.hidden = false;
          entry.toggle.setAttribute('aria-controls', entry.children.id);
          updateFold(entry);
        });
        list.replaceChildren(fragment);
        empty.hidden = headings.length > 0;
        updateFoldControls();
      }
      entries.forEach((entry, index) => { entry.heading = headings[index]; });
      scheduleCurrent();
    });
  }
  toggle.addEventListener('click', () => setOpen(sidebar.hidden));
  expandAll.addEventListener('click', () => setAllCollapsed(false));
  collapseAll.addEventListener('click', () => setAllCollapsed(true));
  list.addEventListener('focusin', updateGuide);
  list.addEventListener('focusout', () => queueMicrotask(updateGuide));
  document.getElementById('outline-close').addEventListener('click', () => { setOpen(false); toggle.focus(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && narrow.matches && mobileOpen) { setOpen(false); toggle.focus(); }
  });
  narrow.addEventListener('change', updateVisibility);
  window.addEventListener('scroll', scheduleCurrent, { passive: true });
  window.addEventListener('resize', scheduleCurrent);
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--toolbar-height', `${toolbar.offsetHeight}px`);
    scheduleCurrent();
  }).observe(toolbar);
  updateVisibility();
  return { refresh };
}
