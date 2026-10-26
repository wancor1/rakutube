const assert = require('node:assert/strict');
const vm = require('node:vm');
const { source, scriptsFor, launchBrowser, newTestPage } = require('./helpers.cjs');

async function checkRouting() {
  const tabs = [];
  const calls = [];
  let listener;
  let ready = false;
  let failCreate = false;
  const context = vm.createContext({ URL, setTimeout, Promise, Date, chrome: {
    runtime: { id: 'test', onMessage: { addListener: value => { listener = value; } } },
    storage: { local: { get: async defaults => defaults } },
    tabs: {
      query: async () => tabs.slice(),
      create: async options => {
        if (failCreate) throw new Error('Create failed');
        const { url } = options;
        calls.push(['create', url, options]);
        const tab = { id: 1, windowId: 3 };
        tabs.push(tab);
        return tab;
      },
      update: async id => { calls.push(['activate', id]); },
      sendMessage: async (id, message) => {
        if (!ready) { ready = true; throw new Error('Still loading'); }
        calls.push(['send', id, message]);
        return { ok: true };
      }
    },
    windows: { update: async id => { calls.push(['focus', id]); } }
  } });
  context.importScripts = name => vm.runInContext(source(name), context);
  vm.runInContext(source('background.js'), context);
  const sender = { id: 'test', tab: { windowId: 3 }, url: 'https://www.youtube.com/watch?v=abcdefghijk' };
  const send = (id, override = {}) => new Promise(resolve => listener({ type: 'rakutube:open', id, url: 'https://youtu.be/abcdefghijk', ...override }, sender, resolve));
  assert.equal((await Promise.all([send('first'), send('second')])).every(result => result.ok), true);
  assert.equal(calls.filter(call => call[0] === 'create').length, 1);
  assert.equal(calls.filter(call => call[0] === 'send').length, 2);
  tabs.push({ id: 2, windowId: 9, lastAccessed: 9999 });
  await send('third');
  assert.equal(calls.filter(call => call[0] === 'send').at(-1)[1], 1);
  assert.equal((await send('invalid', { url: 'https://example.com/' })).ok, false);
  assert.equal((await send('null', { url: null })).ok, false);
  const save = (url, override = {}) => new Promise(resolve => listener({ type: 'rakutube:save', url },
    { id: 'test', tab: { id: 1, windowId: 3 }, url: 'https://y2down.cc/jaWa/', ...override }, resolve));
  const focusCalls = calls.filter(call => ['focus', 'activate'].includes(call[0])).length;
  assert.equal((await save('https://files.test/video')).ok, true);
  assert.equal(calls.at(-1)[2].active, false);
  assert.equal(calls.at(-1)[2].windowId, 3);
  assert.equal(calls.filter(call => ['focus', 'activate'].includes(call[0])).length, focusCalls);
  for (const url of ['javascript:alert(1)', null, 'https://user:pass@files.test/video']) assert.equal((await save(url)).ok, false);
  assert.equal((await save('https://files.test/video', { url: sender.url })).ok, false);
  failCreate = true;
  assert.equal((await save('https://files.test/video')).ok, false);
  console.log('PASS: loading retry, simultaneous clicks create one tab, reuse, same-window preference, invalid URL');
}
async function checkResults() {
  const browser = await launchBrowser();
  try {
    const page = await newTestPage(browser);
    await page.goto('https://y2down.cc/jaWa/');
    await page.setContent('<input id="download-url"><select id="download-format"><option value="1080">1080p</option><option value="720">720p</option></select><button id="load">Download</button><section class="section-result-list"><div class="section-single-result"><article class="dl-card" data-state="ready"><a class="dl-card__btn" href="https://files.test/old">Old</a></article></div></section>');
    await page.evaluate(() => {
      window.started = [];
      window.saved = [];
      window.failure = '';
      window.alert = message => { window.failure = message; };
      chrome.runtime.sendMessage = async message => {
        if (window.failSave) return { ok: false, error: '保存用ページを開けなかった' };
        saved.push(message.url);
        return { ok: true };
      };
      document.addEventListener('click', event => {
        const link = event.target.closest('a');
        if (link) { event.preventDefault(); saved.push(link.getAttribute('href')); }
      });
      document.querySelector('#load').addEventListener('click', event => {
        const input = document.querySelector('input');
        started.push([input.value, document.querySelector('select').value]);
        event.target.disabled = true;
        const number = started.length;
        setTimeout(() => {
          const result = document.createElement('div');
          result.className = 'section-single-result';
          result.innerHTML = `<article class="dl-card" id="job-${number}" data-state="working"><a class="dl-card__btn" href="#" aria-disabled="true">Wait</a></article>`;
          document.querySelector('.section-result-list').append(result);
          event.target.disabled = false;
        }, 150);
      });
      window.complete = (id, href = `https://files.test/${id}`) => {
        const card = document.querySelector(`#job-${id}`);
        card.dataset.state = 'ready';
        card.querySelector('a').href = href;
        card.querySelector('a').removeAttribute('aria-disabled');
      };
    });
    await page.addScriptTag({ content: scriptsFor('y2down.cc') });
    const request = (id, url, resolution = '1080') => page.evaluate(data => deliverRequest(data), { type: 'rakutube:enqueue', id, url, resolution });
    assert.equal((await request('null', null)).ok, false);
    assert.equal((await request('one', 'https://youtu.be/abcdefghijk')).ok, true);
    await request('one', 'https://youtu.be/abcdefghijk');
    await request('two', 'https://youtu.be/123456789_-', '720');
    await page.waitForFunction(() => started.length === 2 && document.querySelector('#job-2'));
    assert.deepEqual(await page.evaluate(() => started), [['https://youtu.be/abcdefghijk', '1080'], ['https://youtu.be/123456789_-', '720']]);
    assert.deepEqual(await page.evaluate(() => saved), []);
    await page.evaluate(() => complete(2));
    await page.waitForFunction(() => saved.length === 1);
    await page.evaluate(() => complete(1));
    await page.waitForFunction(() => saved.length === 2);
    await page.evaluate(() => { document.querySelector('#job-1').classList.add('changed'); complete(2); });
    await page.waitForTimeout(150);
    assert.deepEqual(await page.evaluate(() => saved), ['https://files.test/2', 'https://files.test/1']);
    await page.evaluate(async () => chrome.storage.local.set({ autoDownload: false }));
    await request('three', 'https://youtu.be/abcdefghijk');
    await page.waitForSelector('#job-3');
    await page.evaluate(() => complete(3));
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => saved.length), 2);
    await page.evaluate(async () => chrome.storage.local.set({ autoDownload: true }));
    await page.waitForFunction(() => saved.length === 3);
    await page.evaluate(async () => chrome.storage.local.set({ autoDownload: false }));
    await request('four', 'https://youtu.be/abcdefghijk');
    await page.waitForSelector('#job-4');
    await page.evaluate(() => { complete(4); document.querySelector('#job-4 a').click(); });
    await page.evaluate(async () => chrome.storage.local.set({ autoDownload: true }));
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => saved.length), 4);
    await request('five', 'https://youtu.be/abcdefghijk');
    await page.waitForSelector('#job-5');
    await page.evaluate(() => complete(5, 'javascript:alert(1)'));
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => saved.length), 4);
    assert.equal(await page.evaluate(() => failure), '');
    await request('six', 'https://youtu.be/abcdefghijk');
    await page.waitForSelector('#job-6');
    await page.evaluate(() => { window.failSave = true; complete(6); });
    await page.waitForFunction(() => !!failure);
    assert.equal(await page.evaluate(() => saved.length), 4);
    assert.match(await page.evaluate(() => failure), /保存用ページを開けなかった/);
    console.log('PASS: queued inputs, duplicate request retry, completion order, no old-result replay, live setting, manual click, unsafe links');
  } finally { await browser.close(); }
}
(async () => { await checkRouting(); await checkResults(); })().catch(error => { console.error(error); process.exitCode = 1; });
