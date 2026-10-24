(() => {
  'use strict';
  const select = document.getElementById('resolution');
  const error = document.getElementById('error');
  let saved = '1080';
  for (const resolution of YouTubeDL.resolutions) {
    const option = document.createElement('option');
    option.value = resolution;
    option.textContent = YouTubeDL.resolutionLabel(resolution);
    select.append(option);
  }
  function showError(message) {
    error.textContent = message;
    error.hidden = !message;
  }
  async function restore() {
    try {
      const settings = await chrome.storage.local.get({ resolution: '1080' });
      saved = YouTubeDL.normalizeResolution(settings.resolution);
      select.value = saved;
      select.disabled = false;
    } catch {
      showError('設定を読み込めない');
    }
  }
  select.addEventListener('change', async () => {
    const resolution = YouTubeDL.normalizeResolution(select.value);
    select.disabled = true;
    showError('');
    try {
      await chrome.storage.local.set({ resolution });
      saved = resolution;
    } catch {
      select.value = saved;
      showError('設定を保存できない');
    } finally {
      select.disabled = false;
    }
  });
  restore();
})();
