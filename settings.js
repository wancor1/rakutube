(() => {
  'use strict';
  const select = document.getElementById('resolution');
  const autoDownload = document.getElementById('auto-download');
  const error = document.getElementById('error');
  let saved = { resolution: '1080', autoDownload: true };
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
      const settings = await chrome.storage.local.get({ resolution: '1080', autoDownload: true });
      saved = { resolution: YouTubeDL.normalizeResolution(settings.resolution), autoDownload: settings.autoDownload !== false };
      select.value = saved.resolution;
      autoDownload.checked = saved.autoDownload;
      select.disabled = false;
      autoDownload.disabled = false;
    } catch {
      showError('設定を読み込めない');
    }
  }
  async function save(event) {
    const key = event.target === select ? 'resolution' : 'autoDownload';
    const value = key === 'resolution' ? YouTubeDL.normalizeResolution(select.value) : autoDownload.checked;
    select.disabled = true;
    autoDownload.disabled = true;
    showError('');
    try {
      await chrome.storage.local.set({ [key]: value });
      saved[key] = value;
    } catch {
      select.value = saved.resolution;
      autoDownload.checked = saved.autoDownload;
      showError('設定を保存できない');
    } finally {
      select.disabled = false;
      autoDownload.disabled = false;
    }
  }
  select.addEventListener('change', save);
  autoDownload.addEventListener('change', save);
  restore();
})();
