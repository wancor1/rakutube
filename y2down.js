(() => {
  'use strict';
  const handoff = new URLSearchParams(location.hash.slice(1));
  const raw = handoff.get('youtube-dl');
  if (!raw) return;
  const url = YouTubeDL.videoUrl(raw);
  if (!url || url !== raw) return;
  history.replaceState(history.state, '', location.pathname + location.search);
  let resolution = '1080';
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function waitFor(find, message) {
    const deadline = Date.now() + 20000;
    do {
      const value = find();
      if (value) return value;
      await delay(100);
    } while (Date.now() < deadline);
    throw new Error(message);
  }
  function canUse(element) {
    return !!element?.isConnected && !element.matches(':disabled') && !element.closest('[inert], [aria-disabled="true"]');
  }
  function findInput() {
    const element = document.querySelector('input#download-url');
    return canUse(element) && !element.readOnly ? element : null;
  }
  function findDownloadButton() {
    const element = document.querySelector('button#load');
    return canUse(element) ? element : null;
  }
  function notifyChange(element) {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function enterUrl(input) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, url);
    notifyChange(input);
    if (input.value !== url) throw new Error('URLを入力できなかった');
  }
  function selectResolution() {
    const select = document.querySelector('select#download-format');
    const option = canUse(select) && YouTubeDL.formatFor(select.options, resolution);
    if (!option) return null;
    select.value = option.value;
    select.setAttribute('data-quality', resolution);
    notifyChange(select);
    return select.value === option.value && select.selectedOptions[0] === option ? select : null;
  }
  function checkBeforeClick(button) {
    const currentInput = document.querySelector('input#download-url');
    const currentSelect = document.querySelector('select#download-format');
    if (!canUse(currentInput) || currentInput.readOnly || currentInput.value !== url ||
        !canUse(currentSelect) || !YouTubeDL.formatFor(currentSelect.selectedOptions, resolution) || !canUse(button)) {
      throw new Error('URLか解像度の選択が変更された');
    }
  }
  async function run() {
    const settings = await chrome.storage.local.get({ resolution: '1080' });
    resolution = YouTubeDL.normalizeResolution(settings.resolution);
    const input = await waitFor(findInput, 'URL入力欄を編集できない');
    enterUrl(input);
    await waitFor(selectResolution, `${YouTubeDL.resolutionLabel(resolution)}を選択できない`);
    const button = await waitFor(findDownloadButton, 'ダウンロードボタンを押せない');
    checkBeforeClick(button);
    button.click();
  }
  run().catch(error => alert(`DL: ${error.message}`));
})();
