// Screenshots of every view at 1280 and 375, light and dark; asserts no JS errors, no horizontal scroll, no text under 13px.
const fs = require('fs');
const { openApp, chromium } = require('./fixture');
const VIEWS = ['overview', 'expenses', 'strings', 'deposits', 'reports', 'settings'];

(async () => {
  fs.mkdirSync('shots', { recursive: true });
  const browser = await chromium.launch(), problems = [];
  for (const [w, h, mobile] of [[1280, 860, false], [375, 812, true]]) for (const dark of [false, true]) {
    const tag = `${w}-${dark ? 'dark' : 'light'}`;
    const { page, errors, close } = await openApp({ width: w, height: h, mobile, dark, browser });
    for (const v of VIEWS) {
      await page.evaluate(x => { location.hash = x; }, v);
      await page.waitForTimeout(250);
      const r = await page.evaluate(() => {
        const small = new Set();
        for (const el of document.querySelectorAll('body *')) {
          if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
          const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
          if (own && parseFloat(getComputedStyle(el).fontSize) < 13) small.add(el.tagName.toLowerCase() + '.' + el.className + ' "' + el.textContent.trim().slice(0, 20) + '"');
        }
        return { over: document.documentElement.scrollWidth > innerWidth, small: [...small].slice(0, 5) };
      });
      if (r.over) problems.push(`${tag} ${v}: horizontal scroll`);
      if (r.small.length) problems.push(`${tag} ${v}: text <13px ${r.small.join(' | ')}`);
      await page.screenshot({ path: `shots/${tag}-${v}.png`, fullPage: true });
    }
    await page.evaluate(() => { location.hash = 'expenses'; });
    await page.waitForTimeout(200);
    await page.click('[data-act="expense-new"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `shots/${tag}-form.png` });
    errors.forEach(e => problems.push(`${tag}: JS ${e}`));
    await close();
  }
  await browser.close();
  if (problems.length) { console.error('shots.js: FAIL\n' + problems.join('\n')); process.exit(1); }
  console.log('shots.js: PASS');
})();
