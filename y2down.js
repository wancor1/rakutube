(() => {
  'use strict';
  if (globalThis.__rakuTubeReceiver) return;
  globalThis.__rakuTubeReceiver = true;
  let queue = Promise.resolve();
  const accepted = new Set();
  const handled = new WeakSet();
  let autoDownload = false;
  const readySelector = '.section-result-list .dl-card[data-state="ready"] a.dl-card__btn';
  for (const button of document.querySelectorAll(readySelector)) handled.add(button);
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function waitFor(find, message, timeout = 20000) {
    const deadline = Date.now() + timeout;
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
  function enterUrl(input, url) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, url);
    notifyChange(input);
    if (input.value !== url) throw new Error('URLを入力できなかった');
  }
  function selectResolution(resolution) {
    const select = document.querySelector('select#download-format');
    const option = canUse(select) && YouTubeDL.formatFor(select.options, resolution);
    if (!option) return null;
    select.value = option.value;
    select.setAttribute('data-quality', resolution);
    notifyChange(select);
    return select.value === option.value && select.selectedOptions[0] === option ? select : null;
  }
  function checkBeforeClick(button, url, resolution) {
    const currentInput = document.querySelector('input#download-url');
    const currentSelect = document.querySelector('select#download-format');
    if (!canUse(currentInput) || currentInput.readOnly || currentInput.value !== url ||
        !canUse(currentSelect) || !YouTubeDL.formatFor(currentSelect.selectedOptions, resolution) || !canUse(button)) {
      throw new Error('URLか解像度の選択が変更された');
    }
  }
  async function run(url, resolution) {
    await waitFor(findDownloadButton, 'ダウンロードボタンを押せない', 60000);
    const input = await waitFor(findInput, 'URL入力欄を編集できない');
    enterUrl(input, url);
    await waitFor(() => selectResolution(resolution), `${YouTubeDL.resolutionLabel(resolution)}を選択できない`);
    const button = await waitFor(findDownloadButton, 'ダウンロードボタンを押せない');
    checkBeforeClick(button, url, resolution);
    const existing = new Set(document.querySelectorAll('.section-result-list .dl-card'));
    button.click();
    await waitFor(() => Array.from(document.querySelectorAll('.section-result-list .section-single-result:not(.section-single-result--placeholder) .dl-card'))
      .some(card => !existing.has(card)), '処理結果を確認できない', 60000);
    // The site throttles its start button for 300 ms, even after accepting a job.
    await delay(350);
  }
  function enqueue(request) {
    const url = YouTubeDL.videoUrl(request.url);
    if (!url || url !== request.url || typeof request.id !== 'string' || !request.id) return { ok: false, error: '動画URLを確認できない' };
    if (accepted.has(request.id)) return { ok: true };
    accepted.add(request.id);
    queue = queue.then(() => run(request.url, YouTubeDL.normalizeResolution(request.resolution)))
      .catch(error => alert(`DL: ${error.message}`));
    return { ok: true };
  }
  function downloadReady() {
    if (!autoDownload) return;
    for (const button of document.querySelectorAll(readySelector)) {
      if (handled.has(button) || !canUse(button) || button.classList.contains('disabled')) continue;
      const href = button.getAttribute('href');
      if (!href || !/^https?:\/\//i.test(href)) continue;
      handled.add(button);
      openResult(href).catch(error => alert(`DL: ${error.message}`));
    }
  }
  async function openResult(url) {
    const response = await chrome.runtime.sendMessage({ type: 'rakutube:save', url });
    if (!response?.ok) throw new Error(response?.error || '保存用ページを開けなかった');
  }
  document.addEventListener('click', event => {
    const button = event.target.closest?.(readySelector);
    if (button) handled.add(button);
  }, true);
  new MutationObserver(downloadReady).observe(document.documentElement, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['data-state', 'href', 'class', 'aria-disabled', 'inert'] });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.autoDownload) return;
    autoDownload = changes.autoDownload.newValue !== false;
    downloadReady();
  });
  chrome.runtime.onMessage.addListener((request, sender, respond) => {
    if (request?.type !== 'rakutube:enqueue' || sender.id !== chrome.runtime.id) return;
    respond(enqueue(request));
  });
  chrome.storage.local.get({ resolution: '1080', autoDownload: true }).then(settings => {
    autoDownload = settings.autoDownload !== false;
    downloadReady();
    const raw = new URLSearchParams(location.hash.slice(1)).get('youtube-dl');
    if (!raw || YouTubeDL.videoUrl(raw) !== raw) return;
    history.replaceState(history.state, '', location.pathname + location.search);
    enqueue({ id: 'hash-handoff', url: raw, resolution: settings.resolution });
  }).catch(error => alert(`DL: ${error.message}`));
})();
