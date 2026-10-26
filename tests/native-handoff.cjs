const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { root, outputFile } = require('./helpers.cjs');
const { chromium } = require(process.argv[2] || 'playwright');
const youtube = '<!doctype html><ytd-watch-metadata><div id="top-level-buttons-computed"><div id="share"><button aria-label="Share">Share</button></div></div></ytd-watch-metadata>';
const target = `<!doctype html><input id="download-url"><select id="download-format"><option value="1080">1080p</option><option value="720">720p</option></select><button id="load">Download</button><section class="section-result-list"></section><script>
window.started=[];window.saved=[];
document.addEventListener('click',event=>{const link=event.target.closest('a');if(link){event.preventDefault();saved.push(link.href);}});
document.querySelector('#load').onclick=()=>{
started.push([document.querySelector('input').value,document.querySelector('select').value]);
const result=document.createElement('div');result.className='section-single-result';
result.innerHTML='<article class="dl-card" id="job-'+started.length+'" data-state="working"><a class="dl-card__btn" href="#" aria-disabled="true">Wait</a></article>';
document.querySelector('.section-result-list').append(result);};
window.complete=id=>{const card=document.querySelector('#job-'+id);card.dataset.state='ready';const link=card.querySelector('a');link.href='https://files.test/'+id;link.removeAttribute('aria-disabled');};
</script>`;
(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rakutube-native-'));
  const extensions = process.argv[4] ? `${root},${path.resolve(process.argv[4])}` : root;
  const context = await chromium.launchPersistentContext(profile, {
    headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}),
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extensions}`, `--load-extension=${extensions}`]
  });
  context.setDefaultTimeout(15000);
  await context.setOffline(true);
  try {
    const errors = [];
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    await context.route(/^https?:\/\//, route => {
      const url = new URL(route.request().url());
      return route.fulfill({ contentType: 'text/html', body: url.hostname === 'y2down.cc' ? target : youtube });
    });
    const worker = context.serviceWorkers().find(item => item.url().endsWith('/background.js')) ||
      await context.waitForEvent('serviceworker', item => item.url().endsWith('/background.js'));
    assert.equal(await worker.evaluate(() => chrome.runtime.getManifest().name), 'RakuTube');
    const extensionId = new URL(worker.url()).hostname;
    if (process.argv[4]) {
      const enhancer = context.serviceWorkers().find(item => item.url().endsWith('/js/service-worker.js')) ||
        await context.waitForEvent('serviceworker', item => item.url().endsWith('/js/service-worker.js'));
      await enhancer.evaluate(async () => {
        for (let i = 0; i < 50; i++) {
          const settings = await chrome.storage.local.get({ date: 0, update: 0 });
          if (settings.date && settings.update) return;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('Enhancer installation did not complete');
      });
    }
    const settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/settings.html`);
    await settings.waitForFunction(() => !document.querySelector('select').disabled);
    assert.equal(await settings.locator('#auto-download').isChecked(), true);
    await settings.setViewportSize({ width: 260, height: 170 });
    await settings.screenshot({ path: outputFile('settings-native-light.png') });
    await settings.emulateMedia({ colorScheme: 'dark' });
    await settings.screenshot({ path: outputFile('settings-native-dark.png') });
    const existing = await context.newPage();
    await existing.goto('https://y2down.cc/jaWa/');
    const video = await context.newPage();
    await video.goto('https://www.youtube.com/watch?v=abcdefghijk&si=tracking');
    await video.locator('#youtube-dl-button').click();
    await existing.waitForFunction(() => started.length === 1);
    await settings.locator('#resolution').selectOption('720');
    await settings.waitForFunction(async () => (await chrome.storage.local.get({})).resolution === '720');
    await video.goto('https://www.youtube.com/watch?v=123456789_-');
    await video.locator('#youtube-dl-button').click();
    await existing.waitForFunction(() => started.length === 2);
    assert.deepEqual(await existing.evaluate(() => started), [['https://youtu.be/abcdefghijk', '1080'], ['https://youtu.be/123456789_-', '720']]);
    assert.equal(context.pages().filter(page => page.url().startsWith('https://y2down.cc/jaWa/')).length, 1);
    await worker.evaluate(() => {
      globalThis.savedTabs = [];
      chrome.tabs.onCreated.addListener(tab => savedTabs.push({ id: tab.id, active: tab.active, windowId: tab.windowId }));
    });
    const waitSaved = count => worker.evaluate(async expected => {
      const deadline = Date.now() + 10000;
      while (savedTabs.length !== expected) {
        if (Date.now() > deadline) throw new Error('Save tab count did not match');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }, count);
    await video.bringToFront();
    const activeBefore = await worker.evaluate(async () => (await chrome.tabs.query({ active: true })).map(tab => tab.id));
    await existing.evaluate(() => complete(2));
    await waitSaved(1);
    await existing.evaluate(() => complete(1));
    await waitSaved(2);
    assert.equal(await worker.evaluate(() => savedTabs.every(tab => !tab.active)), true);
    assert.deepEqual(await worker.evaluate(async () => (await chrome.tabs.query({ active: true })).map(tab => tab.id)), activeBefore);
    assert.deepEqual(await existing.evaluate(() => saved), []);
    await settings.locator('#auto-download').uncheck();
    await settings.waitForFunction(async () => (await chrome.storage.local.get({})).autoDownload === false);
    await video.locator('#youtube-dl-button').click();
    await existing.waitForSelector('#job-3');
    await existing.evaluate(() => complete(3));
    await existing.waitForTimeout(150);
    assert.equal(await worker.evaluate(() => savedTabs.length), 2);
    await settings.locator('#auto-download').check();
    await waitSaved(3);
    await settings.reload();
    await settings.waitForFunction(() => !document.querySelector('select').disabled);
    assert.equal(await settings.locator('select').inputValue(), '720');
    assert.equal(await settings.locator('#auto-download').isChecked(), true);
    await existing.close();
    const next = context.waitForEvent('page');
    await video.locator('#youtube-dl-button').click();
    const created = await next;
    // Extension-created tabs can issue their first request before Playwright attaches routing.
    // Offline mode blocks that request; navigate again through the registered fixture route.
    await created.goto('https://y2down.cc/jaWa/');
    await created.waitForFunction(() => window.started?.length === 1);
    assert.equal(await created.locator('input').inputValue(), 'https://youtu.be/123456789_-');
    assert.deepEqual(errors, []);
    console.log('PASS: loaded extension, existing tab reuse, real inactive save tabs, active tab unchanged, live setting, new tab fallback');
  } catch (error) {
    console.error('Open test pages:', context.pages().map(page => page.url()));
    throw error;
  } finally { await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
