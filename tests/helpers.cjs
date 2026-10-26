const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');
const manifest = JSON.parse(source('manifest.json'));
function scriptsFor(host) {
  const entry = manifest.content_scripts.find(item => item.matches.some(pattern => new URL(pattern).hostname === host));
  if (!entry) throw new Error(`No content scripts for ${host}`);
  return entry.js.map(source).join('\n');
}
async function launchBrowser() {
  const { chromium } = require(process.argv[2] || 'playwright');
  return chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
}
async function newTestPage(browser, initialSettings = {}) {
  const page = await browser.newPage();
  const settings = { ...initialSettings };
  await page.exposeBinding('__extensionStorage', (_source, operation, value) => {
    if (operation === 'set') Object.assign(settings, value);
    return { ...value, ...settings };
  });
  await page.addInitScript(() => {
    const listeners = [];
    globalThis.chrome ||= {};
    chrome.runtime = {
      id: 'rakutube-test',
      onMessage: { addListener: listener => listeners.push(listener) },
      sendMessage: async message => { globalThis.sentMessage = message; return { ok: true }; }
    };
    globalThis.deliverRequest = request => new Promise(resolve => {
      for (const listener of listeners) listener(request, { id: chrome.runtime.id }, resolve);
    });
    const storageListeners = [];
    chrome.storage = { local: {
      get: defaults => globalThis.__failStorageGet ? Promise.reject(new Error('Read failed')) : globalThis.__extensionStorage('get', defaults),
      set: async value => {
        if (globalThis.__failStorageSet) throw new Error('Write failed');
        await globalThis.__extensionStorage('set', value);
        const changes = Object.fromEntries(Object.entries(value).map(([key, newValue]) => [key, { newValue }]));
        for (const listener of storageListeners) listener(changes, 'local');
      }
    }, onChanged: { addListener: listener => storageListeners.push(listener) } };
  });
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
  return page;
}
function outputFile(name) {
  const directory = path.join(root, 'test-results');
  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, name);
}
module.exports = { root, source, scriptsFor, launchBrowser, newTestPage, outputFile };
