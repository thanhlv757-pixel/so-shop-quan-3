// Đan vợt page: day mode, person mode, batched upsert, flush on navigation, rollback on error.
const assert = require('assert/strict');
const { openApp } = require('./fixture');

const upserts = w => w.filter(([m, p]) => m === 'POST' && p.endsWith('/strings')).map(x => [].concat(x[2])[0]);
const focused = page => page.evaluate(() => document.activeElement?.id);

(async () => {
  // Day mode
  let app = await openApp({ hash: 'strings' });
  let { page, writes, errors } = app;
  await page.waitForSelector('#sv-mode-day');
  assert.equal(await page.getAttribute('#sv-mode-day', 'aria-pressed'), 'true');
  assert.match(await page.textContent('#sv-day-label'), /24\/11/);
  await page.fill('#sv-d-0', '5');
  await page.press('#sv-d-0', 'Enter');
  assert.equal(await focused(page), 'sv-d-1');
  await page.waitForTimeout(900);
  const before = upserts(writes).length;
  for (let i = 0; i < 3; i++) await page.click('[data-sv-step="1"][data-emp="Thái"]');
  await page.waitForTimeout(900);
  let u = upserts(writes);
  assert.equal(u.length, before + 1, 'three quick taps = one upsert');
  const last = u[u.length - 1];
  assert.equal(last.date, '2026-11-24');
  assert.deepEqual({ Thành: last.counts['Thành'], Thái: last.counts['Thái'] }, { Thành: 5, Thái: 3 });
  assert.match(await page.textContent('#sv-day-total'), /8/);

  // Flush on day change before the debounce fires
  const n0 = upserts(writes).length;
  await page.click('[data-sv-step="1"][data-emp="Bình"]');
  await page.click('#sv-prev');
  await page.waitForTimeout(150);
  u = upserts(writes);
  assert.equal(u.length, n0 + 1, 'flushed on day change');
  assert.equal(u[u.length - 1].counts['Bình'], 1);
  assert.match(await page.textContent('#sv-day-label'), /23\/11/);

  // Person mode
  await page.click('#sv-mode-emp');
  await page.click('[data-sv-who="Bình"]');
  await page.fill('#sv-p-2026-11-01', '7');
  await page.press('#sv-p-2026-11-01', 'Enter');
  assert.equal(await focused(page), 'sv-p-2026-11-02');
  await page.waitForTimeout(900);
  u = upserts(writes);
  const nov1 = u.find(x => x.date === '2026-11-01');
  assert.deepEqual(nov1.counts, { Thành: 4, Thái: 2, Bình: 7 }, 'keeps other people on that day');
  assert.equal(await page.locator('#sv-p-2026-11-25').count(), 0, 'no future days');
  assert.deepEqual(errors, []);
  await app.close();

  // Rollback on failed save
  app = await openApp({ hash: 'strings', failWrites: true });
  ({ page, writes, errors } = app);
  await page.waitForSelector('#sv-d-0');
  assert.equal(await page.inputValue('#sv-d-0'), '1');
  await page.click('[data-sv-step="1"][data-emp="Thành"]');
  assert.equal(await page.inputValue('#sv-d-0'), '2');
  await page.waitForTimeout(1200);
  assert.equal(await page.inputValue('#sv-d-0'), '1', 'rolled back');
  assert.equal(await page.isVisible('#toast'), true);
  assert.deepEqual(errors, []);
  await app.close();

  console.log('strings.js: PASS');
})().catch(e => { console.error('strings.js: FAIL\n', e.message); process.exit(1); });
