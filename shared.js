(() => {
  'use strict';
  const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
  const resolutions = Object.freeze(['4k', '1440', '1080', '720', '480', '360', '240', '144']);
  function normalizeResolution(value) {
    return resolutions.includes(value) ? value : '1080';
  }
  function resolutionLabel(value) {
    return value === '4k' ? '4K' : `${value}p`;
  }
  function videoUrl(address) {
    try {
      const url = new URL(address);
      if (!['www.youtube.com', 'youtube.com', 'youtu.be'].includes(url.hostname)) return null;
      const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) :
        url.pathname === '/watch' ? url.searchParams.get('v') : null;
      return videoIdPattern.test(id || '') ? `https://youtu.be/${id}` : null;
    } catch {
      return null;
    }
  }
  function formatFor(options, resolution) {
    const value = normalizeResolution(resolution);
    const pattern = value === '4k' ? /(?:^|\W)4k(?:\W|$)|(?:^|\D)2160(?:p|\D|$)/i : new RegExp(`(?:^|\\D)${value}(?:p|\\D|$)`, 'i');
    return Array.from(options).find(option => !option.matches(':disabled') &&
      [option.value, option.textContent, option.getAttribute('data-quality') || '']
        .some(text => pattern.test(text)));
  }
  globalThis.YouTubeDL = Object.freeze({ videoUrl, resolutions, normalizeResolution, resolutionLabel, formatFor });
})();
