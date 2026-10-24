(() => {
  'use strict';
  const buttonId = 'youtube-dl-button';
  let scheduled = false;
  function createIcon() {
    const wrapper = document.createElement('span');
    wrapper.className = 'ytIconWrapperHost';
    const shape = document.createElement('span');
    shape.className = 'yt-icon-shape ytSpecIconShapeHost';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [name, value] of Object.entries({ width: '24', height: '24', viewBox: '0 0 24 24', focusable: 'false', 'aria-hidden': 'true' })) svg.setAttribute(name, value);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M11 3h2v10.17l3.59-3.58L18 11l-6 6-6-6 1.41-1.41L11 13.17V3ZM5 19h14v-4h2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4h2v4Z');
    svg.append(path);
    shape.append(svg);
    wrapper.append(shape);
    return wrapper;
  }
  function matchStyle(button, source) {
    if (button.className !== source.className) button.className = source.className;
    const style = getComputedStyle(source);
    for (const [name, value] of Object.entries({ height: style.height, radius: style.borderRadius, background: style.backgroundColor, color: style.color })) {
      const property = `--youtube-dl-${name}`;
      if (button.style.getPropertyValue(property) !== value) button.style.setProperty(property, value);
    }
  }
  function findShareAction() {
    const groups = document.querySelectorAll('ytd-watch-metadata #top-level-buttons-computed, #menu-container #top-level-buttons-computed');
    for (const group of groups) {
      if (!group.getClientRects().length) continue;
      const button = Array.from(group.querySelectorAll('button, [role="button"]')).find(item => {
        if (!item.getClientRects().length || item.closest('[hidden], [inert]') || getComputedStyle(item).visibility !== 'visible') return false;
        const label = `${item.getAttribute('aria-label') || ''} ${item.getAttribute('title') || ''} ${item.textContent || ''}`;
        return /共有|シェア|\bshare\b/i.test(label);
      });
      if (!button) continue;
      let host = button;
      while (host.parentElement !== group && host.parentElement) host = host.parentElement;
      return { button, host };
    }
    return null;
  }
  function createButton() {
    const button = document.createElement('button');
    button.id = buttonId;
    button.type = 'button';
    button.setAttribute('aria-label', 'ダウンロード');
    button.append(createIcon());
    YouTubeDLTooltip.attach(button);
    button.addEventListener('click', () => {
      const url = YouTubeDL.videoUrl(location.href);
      if (url) window.open(`https://y2down.cc/jaWa/#youtube-dl=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
    });
    return button;
  }
  function sync() {
    scheduled = false;
    const existing = document.getElementById(buttonId);
    const share = YouTubeDL.videoUrl(location.href) && findShareAction();
    if (!share) {
      YouTubeDLTooltip.hide();
      existing?.remove();
      return;
    }
    const button = existing || createButton();
    matchStyle(button, share.button);
    if (share.host.nextElementSibling !== button) share.host.after(button);
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label', 'hidden'] });
  document.addEventListener('yt-navigate-finish', schedule);
  window.addEventListener('popstate', schedule);
  setInterval(schedule, 1000);
  schedule();
})();
