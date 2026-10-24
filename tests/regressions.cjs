const assert = require('node:assert/strict');
const { source, scriptsFor, launchBrowser, newTestPage } = require('./helpers.cjs');
(async () => {
  const browser = await launchBrowser();
  let failures = 0;
  try {
    async function check(name, test) {
      const page = await newTestPage(browser);
      try { await test(page); console.log('PASS: ' + name); }
      catch (error) { failures++; console.log('FAIL: ' + name + ' - ' + error.message); }
      finally { await page.close(); }
    }
    await check('hidden share must not hide DL beside an invisible action', async page => {
      await page.goto('https://www.youtube.com/watch?v=abcdefghijk');
      await page.setContent('<ytd-watch-metadata><div id="top-level-buttons-computed"><div id="hidden" hidden><button aria-label="共有">共有</button></div><div id="visible"><button aria-label="Share">Share</button></div></div></ytd-watch-metadata>');
      await page.addScriptTag({ content: scriptsFor('www.youtube.com') });
      await page.locator('#youtube-dl-button').waitFor();
      assert.equal(await page.locator('#visible + #youtube-dl-button').count(), 1);
    });
    await check('disabled optgroup must not be selected', async page => {
      await page.goto('https://y2down.cc/jaWa/');
      await page.setContent('<select><optgroup disabled><option value="bad1080">1080p unavailable</option></optgroup><option value="good1080">1080p</option></select>');
      await page.addScriptTag({ content: source('shared.js') });
      assert.equal(await page.evaluate(() => YouTubeDL.formatFor(document.querySelector('select').options, '1080').value), 'good1080');
    });
    await check('readonly URL must wait before input, then preserve order', async page => {
      await page.goto('https://y2down.cc/jaWa/#youtube-dl=https%3A%2F%2Fyoutu.be%2Fabcdefghijk');
      await page.setContent('<input id="download-url" readonly><select id="download-format"><option value="720">720p</option><option value="1080">1080p</option></select><button id="load">Download</button>');
      await page.evaluate(() => {
        window.steps = [];
        window.alert = text => steps.push('error:' + text);
        document.querySelector('input').addEventListener('input', () => steps.push('input'));
        document.querySelector('select').addEventListener('change', () => steps.push('format'));
        document.querySelector('button').addEventListener('click', () => steps.push('click'));
      });
      await page.addScriptTag({ content: scriptsFor('y2down.cc') });
      await page.waitForTimeout(200);
      assert.deepEqual(await page.evaluate(() => steps), []);
      await page.evaluate(() => document.querySelector('input').readOnly = false);
      await page.waitForFunction(() => steps.includes('click'));
      assert.deepEqual(await page.evaluate(() => steps), ['input', 'format', 'click']);
    });
    await check('tooltip closes when the video menu is replaced', async page => {
      await page.goto('https://www.youtube.com/watch?v=abcdefghijk');
      await page.setContent('<ytd-watch-metadata><div id="top-level-buttons-computed"><div><button aria-label="Share">Share</button></div></div></ytd-watch-metadata>');
      await page.addScriptTag({ content: scriptsFor('www.youtube.com') });
      await page.locator('#youtube-dl-button').focus();
      await page.locator('#youtube-dl-tooltip').waitFor({ state: 'visible' });
      await page.evaluate(() => {
        document.querySelector('ytd-watch-metadata').innerHTML = '<div id="top-level-buttons-computed"><div><button aria-label="Share">Share</button></div></div>';
      });
      await page.locator('#youtube-dl-button').waitFor();
      await page.waitForTimeout(200);
      assert.equal(await page.locator('#youtube-dl-tooltip').isVisible(), false);
    });
    for (const unavailable of ['select', 'button']) {
      await check(`${unavailable} waits while temporarily unavailable`, async page => {
        await page.goto('https://y2down.cc/jaWa/#youtube-dl=https%3A%2F%2Fyoutu.be%2Fabcdefghijk');
        await page.setContent('<input id="download-url"><select id="download-format"><option value="720">720p</option><option value="1080">1080p</option></select><button id="load">Download</button>');
        await page.evaluate(target => {
          window.steps = [];
          window.alert = message => steps.push('error:' + message);
          const element = document.querySelector(target);
          if (target === 'select') element.setAttribute('aria-disabled', 'true');
          else element.inert = true;
          document.querySelector('button').addEventListener('click', () => steps.push('click'));
        }, unavailable);
        await page.addScriptTag({ content: scriptsFor('y2down.cc') });
        await page.waitForTimeout(200);
        assert.deepEqual(await page.evaluate(() => steps), []);
        await page.evaluate(target => {
          const element = document.querySelector(target);
          element.removeAttribute('aria-disabled');
          element.inert = false;
        }, unavailable);
        await page.waitForFunction(() => steps.includes('click'));
        assert.deepEqual(await page.evaluate(() => steps), ['click']);
      });
    }
  } finally { await browser.close(); }
  process.exitCode = failures ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
