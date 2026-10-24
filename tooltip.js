(() => {
  'use strict';
  let tooltip = null;
  let timer = null;
  function hide() {
    clearTimeout(timer);
    if (tooltip) tooltip.hidden = true;
  }
  function show(button, delay = 500) {
    hide();
    timer = setTimeout(() => {
      if (!button.isConnected || !button.getClientRects().length) return;
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'youtube-dl-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        tooltip.textContent = 'ダウンロード';
      }
      if (!tooltip.isConnected) document.body.append(tooltip);
      tooltip.hidden = false;
      const rect = button.getBoundingClientRect();
      const tip = tooltip.getBoundingClientRect();
      tooltip.style.left = `${Math.max(8, Math.min(rect.left + (rect.width - tip.width) / 2, innerWidth - tip.width - 8))}px`;
      tooltip.style.top = `${rect.bottom + tip.height + 8 <= innerHeight ? rect.bottom + 8 : Math.max(8, rect.top - tip.height - 8)}px`;
    }, delay);
  }
  function attach(button) {
    button.addEventListener('mouseenter', () => show(button));
    button.addEventListener('mouseleave', hide);
    button.addEventListener('focus', () => show(button, 0));
    button.addEventListener('blur', hide);
    button.addEventListener('click', hide);
  }
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
  globalThis.YouTubeDLTooltip = Object.freeze({ attach, hide });
})();
