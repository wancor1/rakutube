const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { root, scriptsFor, launchBrowser, newTestPage, outputFile } = require('./helpers.cjs');
const youtube = scriptsFor('www.youtube.com');
const target = scriptsFor('y2down.cc');
const groups = '<style>body{--yt-spec-button-chip-background-hover:#ddd}body.dark{--yt-spec-button-chip-background-hover:#444;background:#0f0f0f}.native-button{height:36px;border:0;border-radius:18px;background:#eee;color:#0f0f0f;padding:0 16px}body.dark .native-button{background:#272727;color:#f1f1f1}#top-level-buttons-computed{display:flex;align-items:center}</style><ytd-watch-metadata><div id="top-level-buttons-computed"><div id="share"><button class="native-button" aria-label="共有">共有</button></div><div id="save">Save</div></div></ytd-watch-metadata>';
(async () => {
  const browser = await launchBrowser();
  try {
    const page = await newTestPage(browser);
    await page.goto('https://www.youtube.com/watch?v=abcdefghijk&si=tracking&t=10');
    await page.setContent(groups);
    await page.addStyleTag({ path: path.join(root, 'youtube.css') });
    await page.evaluate(() => { window.open = (...args) => { window.opened = args; }; });
    await page.addScriptTag({ content: youtube });
    await page.locator('#youtube-dl-button').waitFor();
    assert.equal(await page.locator('#share + #youtube-dl-button').count(), 1);
    assert.equal(await page.locator('#youtube-dl-button').textContent(), '');
    assert.equal(await page.locator('#youtube-dl-button').getAttribute('aria-label'), 'ダウンロード');
    assert.equal(await page.locator('#youtube-dl-button svg path').count(), 1);
    async function checkStyle() {
      assert.equal(await page.evaluate(() => {
        const native = getComputedStyle(document.querySelector('#share button'));
        const dl = getComputedStyle(document.querySelector('#youtube-dl-button'));
        const svg = document.querySelector('#youtube-dl-button svg').getBoundingClientRect();
        return ['height', 'borderRadius', 'backgroundColor', 'color'].every(key => native[key] === dl[key]) && dl.width === dl.height && svg.width === 24 && svg.height === 24;
      }), true);
    }
    await checkStyle();
    await page.evaluate(() => document.body.classList.add('dark'));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#youtube-dl-button')).backgroundColor === 'rgb(39, 39, 39)');
    await checkStyle();
    await page.screenshot({ path: outputFile('dark.png'), clip: { x: 0, y: 0, width: 320, height: 100 } });
    await page.evaluate(() => document.body.classList.remove('dark'));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#youtube-dl-button')).backgroundColor === 'rgb(238, 238, 238)');
    await checkStyle();
    console.log('PASS: SVG, accessible name, native classes, light/dark colors, size, radius');
    const tooltip = page.locator('#youtube-dl-tooltip');
    await page.locator('#youtube-dl-button').hover();
    await tooltip.waitFor({ state: 'visible' });
    assert.equal(await tooltip.textContent(), 'ダウンロード');
    await page.screenshot({ path: outputFile('tooltip.png'), clip: { x: 0, y: 0, width: 320, height: 120 } });
    await page.mouse.move(300, 100);
    await tooltip.waitFor({ state: 'hidden' });
    await page.locator('#youtube-dl-button').focus();
    await tooltip.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await tooltip.waitFor({ state: 'hidden' });
    await page.locator('#youtube-dl-button').evaluate(button => button.blur());
    await page.locator('#youtube-dl-button').focus();
    await tooltip.waitFor({ state: 'visible' });
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await tooltip.waitFor({ state: 'hidden' });
    console.log('PASS: tooltip hover, keyboard focus, mouse leave, Escape, scroll');
    for (let i = 0; i < 4; i++) await page.evaluate(() => document.dispatchEvent(new Event('yt-navigate-finish')));
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#youtube-dl-button').count(), 1);
    await page.locator('#youtube-dl-button').click();
    assert.equal(await page.evaluate(() => window.sentMessage.url), 'https://youtu.be/abcdefghijk');
    await page.evaluate(() => {
      history.pushState({}, '', '/watch?v=123456789_-&si=other#time');
      document.dispatchEvent(new Event('yt-navigate-finish'));
    });
    await page.locator('#youtube-dl-button').click();
    assert.equal(await page.evaluate(() => window.sentMessage.url), 'https://youtu.be/123456789_-');
    await page.evaluate(() => {
      document.querySelector('ytd-watch-metadata').innerHTML = '<div id="top-level-buttons-computed"><div id="share"><button aria-label="Share">Share</button></div></div>';
    });
    await page.locator('#share + #youtube-dl-button').waitFor();
    await page.evaluate(() => {
      history.pushState({}, '', '/feed/subscriptions');
      document.dispatchEvent(new Event('yt-navigate-finish'));
    });
    await page.locator('#youtube-dl-button').waitFor({ state: 'detached' });
    const urls = await page.evaluate(() => [
      YouTubeDL.videoUrl('https://youtu.be/abcdefghijk?si=x#t=5'),
      YouTubeDL.videoUrl('https://example.com/watch?v=abcdefghijk'),
      YouTubeDL.videoUrl('https://www.youtube.com/watch?v=bad')
    ]);
    assert.deepEqual(urls, ['https://youtu.be/abcdefghijk', null, null]);
    console.log('PASS: placement, label, duplicate prevention, navigation, rerender, URL cleanup');
    async function prepare(options) {
      await page.goto('https://y2down.cc/jaWa/#youtube-dl=https%3A%2F%2Fyoutu.be%2Fabcdefghijk');
      await page.reload();
      await page.setContent(`<input id="download-url"><select id="download-format" data-quality="720">${options}</select><button id="load">Download</button>`);
      await page.evaluate(() => {
        window.steps = [];
        window.alert = text => { window.failure = text; };
        document.querySelector('input').addEventListener('input', event => steps.push('url:' + event.target.value));
        document.querySelector('select').addEventListener('change', event => steps.push('format:' + event.target.value));
        document.querySelector('button').addEventListener('click', () => steps.push('click'));
      });
    }
    await prepare('<option value="720">720p</option><option value="mp4-1080">MP4 1080p</option>');
    await page.addScriptTag({ content: target });
    await page.waitForFunction(() => steps.includes('click'));
    assert.deepEqual(await page.evaluate(() => steps), ['url:https://youtu.be/abcdefghijk', 'format:mp4-1080', 'click']);
    assert.equal(await page.evaluate(() => location.hash), '');
    await page.addScriptTag({ content: target });
    assert.equal(await page.evaluate(() => steps.filter(step => step === 'click').length), 1);
    console.log('PASS: input -> 1080 -> click, one-shot handoff');
    await prepare('<option value="720">720p</option>');
    await page.evaluate(() => {
      const originalNow = Date.now;
      let elapsed = 0;
      Date.now = () => originalNow() + (elapsed += 25000);
    });
    await page.addScriptTag({ content: target });
    await page.waitForFunction(() => window.failure);
    assert.equal(await page.evaluate(() => steps.includes('click')), false);
    assert.match(await page.evaluate(() => window.failure), /1080/);
    console.log('PASS: unavailable 1080 stops without clicking');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    assert.equal(manifest.manifest_version, 3);
    for (const entry of manifest.content_scripts) {
      for (const name of [...entry.js, ...(entry.css || [])]) assert.ok(fs.existsSync(path.join(root, name)));
    }
    console.log('PASS: manifest references');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
