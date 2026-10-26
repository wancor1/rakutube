importScripts('shared.js');

let routing = Promise.resolve();
async function openResult(message, sender) {
  const source = new URL(sender.url);
  const target = new URL(message.url);
  if (sender.id !== chrome.runtime.id || !sender.tab || source.origin !== 'https://y2down.cc' ||
      !source.pathname.startsWith('/jaWa/') || !['https:', 'http:'].includes(target.protocol) || target.username || target.password) {
    throw new Error('保存用URLを確認できない');
  }
  await chrome.tabs.create({ url: target.href, active: false, windowId: sender.tab.windowId });
  return { ok: true };
}
async function forward(message, sender) {
  const settings = await chrome.storage.local.get({ resolution: '1080' });
  const request = { type: 'rakutube:enqueue', id: message.id, url: message.url, resolution: YouTubeDL.normalizeResolution(settings.resolution) };
  const tabs = await chrome.tabs.query({ url: 'https://y2down.cc/jaWa/*' });
  tabs.sort((a, b) => Number(b.windowId === sender.tab.windowId) - Number(a.windowId === sender.tab.windowId) || (b.lastAccessed || 0) - (a.lastAccessed || 0));
  const tab = tabs[0] || await chrome.tabs.create({ url: 'https://y2down.cc/jaWa/' });
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  const deadline = Date.now() + 20000;
  do {
    let response;
    try { response = await chrome.tabs.sendMessage(tab.id, request, { frameId: 0 }); } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }
    if (response?.ok) return { ok: true };
    throw new Error(response?.error || '動画を受け渡せなかった');
  } while (Date.now() < deadline);
  throw new Error('y2downを再読み込みして、もう一度押してね');
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === 'rakutube:save') {
    openResult(message, sender).then(respond, error => respond({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type !== 'rakutube:open') return;
  const url = YouTubeDL.videoUrl(message.url);
  if (sender.id !== chrome.runtime.id || !sender.tab || !YouTubeDL.videoUrl(sender.url) ||
      !url || url !== message.url || typeof message.id !== 'string' || !message.id) {
    respond({ ok: false, error: '動画URLを確認できない' });
    return;
  }
  const task = routing.then(() => forward(message, sender));
  routing = task.catch(() => {});
  task.then(respond, error => respond({ ok: false, error: error.message }));
  return true;
});
