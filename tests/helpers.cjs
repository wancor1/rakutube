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
    globalThis.chrome ||= {};
    chrome.storage = { local: {
      get: defaults => globalThis.__failStorageGet ? Promise.reject(new Error('Read failed')) : globalThis.__extensionStorage('get', defaults),
      set: value => globalThis.__failStorageSet ? Promise.reject(new Error('Write failed')) : globalThis.__extensionStorage('set', value)
    } };
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
