const { chromium } = require('playwright');
const fs = require('fs');
const m = require('../migration/months/2026-10.json');
const ex = m.expenses.map(e => ({ id: e.id, date: e.date, amount: e.amount, category: e.category, purpose: e.purpose, detail: e.detail, invoice: e.invoice, transfer_code: e.transferCode, sales_order_code: e.salesOrderCode, evidence: e.evidence.map(x => ({ path: 'migrated/' + x.id + '.jpg', name: 'image.jpg', size: x.size, type: 'image/jpeg' })), created_at: '2026-10-01T00:00:00Z' }));
const deps = [{ id: 'd1', customer: 'Anh Minh', phone: '0901234567', contact_platform: 'Zalo', contact_handle: 'zalo.me/abc', category: 'Vợt', product: 'Yonex Astrox 99 Pro', variant: '4U', quantity: 1, date: '2026-10-20', amount: 500000, status: 'Đang chờ', closed_date: null, note: '' }];
const settings = { employees: ['Thành', 'Thái', 'Bình'], kpi_target: 450, rate_low: 5000, rate_high: 10000 };
const writes = [];
(async () => {
  const b = await chromium.launch();
  const errors = [];
  async function page(w, h, mobile) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, timezoneId: 'Asia/Ho_Chi_Minh' });
    await ctx.addInitScript(() => {
      const exp = Math.floor(Date.now() / 1000) + 36000;
      localStorage.setItem('sb-jlwayvnokaxiapfaozew-auth-token', JSON.stringify({ access_token: 'x.eyJzdWIiOiJ1MSJ9.y', token_type: 'bearer', expires_in: 36000, expires_at: exp, refresh_token: 'r', user: { id: 'u1', email: 'test@shop.vn', aud: 'authenticated', role: 'authenticated' } }));
    });
    await ctx.route('https://cdn.jsdelivr.net/**', r => { const u = r.request().url(); r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(u.includes('exceljs') ? 'node_modules/exceljs/dist/exceljs.min.js' : 'node_modules/@supabase/supabase-js/dist/umd/supabase.js') }); });
    await ctx.route('http://app.test/**', r => r.fulfill({ contentType: 'text/html', body: fs.readFileSync('../index.html') }));
    await ctx.route('https://jlwayvnokaxiapfaozew.supabase.co/**', async r => {
      const req = r.request(), u = new URL(req.url()), p = u.pathname, single = (req.headers()['accept'] || '').includes('pgrst.object');
      const json = (d, st = 200) => r.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(d), headers: { 'access-control-allow-origin': '*' } });
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (p.endsWith('/rpc/is_member')) return json(true);
      if (req.method() !== 'GET' && p.startsWith('/rest/')) { const body = req.postDataJSON?.() ; writes.push([req.method(), p, body]); return json(single ? (Array.isArray(body) ? body[0] : body) : (body ? [].concat(body) : [])); }
      const tbl = p.split('/').pop();
      const data = { settings: [settings], budgets: [{ amount: 500000 }], expenses: ex, strings: m.strings, deposits: deps, members: [{ email: 'test@shop.vn' }] }[tbl];
      if (data) return json(single ? data[0] : data);
      if (p.includes('/object/sign/evidence') && req.method() === 'POST') { const { paths } = req.postDataJSON(); return json(paths.map(x => ({ path: x, signedURL: '/object/sign/evidence/' + x + '?token=t', error: null }))); }
      if (p.includes('/object/sign/evidence/migrated/')) return r.fulfill({ contentType: 'image/jpeg', body: fs.readFileSync('../migration/images/' + p.split('/').pop()), headers: { 'access-control-allow-origin': '*' } });
      if (p.startsWith('/auth/')) return json({});
      return json({ message: 'unmocked ' + p }, 404);
    });
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errors.push(w + ' ' + e.message));
    pg.on('console', msg => { if (msg.type() === 'error') errors.push(w + ' console ' + msg.text()); });
    return pg;
  }
  for (const [w, h, mob] of [[1280, 860, false], [375, 812, true]]) {
    const pg = await page(w, h, mob);
    await pg.goto('http://app.test/#overview');
    await pg.waitForSelector('.tiles');
    await pg.evaluate(() => { document.querySelector('[data-act=month][data-k="-1"]').click(); });
    await pg.waitForFunction(() => document.querySelector('#month-label')?.textContent.includes('10/2026') && document.querySelector('.tiles'));
    await pg.waitForTimeout(400);
    for (const v of ['overview', 'expenses', 'strings', 'deposits', 'reports', 'settings']) {
      await pg.evaluate(v => location.hash = v, v);
      await pg.waitForTimeout(350);
      const over = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (over > 0) errors.push(`${w} ${v} horizontal overflow ${over}px`);
      await pg.screenshot({ path: `shots/${w}-${v}.png`, fullPage: v !== 'strings' });
    }
    // open expense form
    await pg.evaluate(() => location.hash = 'expenses'); await pg.waitForTimeout(200);
    await pg.click('[data-act=expense-edit]'); await pg.waitForTimeout(500);
    await pg.screenshot({ path: `shots/${w}-form.png` });
    await pg.keyboard.press('Escape');
    // validation
    await pg.click('.head [data-act=expense-new]'); await pg.waitForTimeout(200);
    await pg.click('#sheet-submit'); await pg.waitForTimeout(200);
    const errs = await pg.$$eval('#sheet .err:not([hidden])', e => e.map(x => x.textContent));
    console.log(w, 'validation errors:', errs);
    await pg.screenshot({ path: `shots/${w}-form-err.png` });
    await pg.keyboard.press('Escape');
    if (w === 1280) {
      // string cell save
      await pg.evaluate(() => location.hash = 'strings'); await pg.waitForTimeout(200);
      const inp = pg.locator('input[data-str="2026-10-02"][data-emp="Thái"]');
      await inp.fill('3'); await inp.press('Tab'); await pg.waitForTimeout(300);
      console.log('string write:', JSON.stringify(writes.at(-1)));
      await pg.evaluate(() => location.hash = 'overview'); await pg.waitForTimeout(200);
      await pg.click('[data-act=budget-edit]'); await pg.fill('#budget-tile', '600000'); await pg.screenshot({ path: 'shots/1280-budget-inline.png', clip: { x: 180, y: 100, width: 1100, height: 140 } });
      await pg.press('#budget-tile', 'Enter'); await pg.waitForTimeout(300);
      console.log('budget write:', JSON.stringify(writes.at(-1)), await pg.textContent('.tiles .tile .val'));
      await pg.click('.head [data-act=expense-new]'); await pg.waitForTimeout(200);
      await pg.focus('#sheet [name=purpose]'); await pg.keyboard.press('Tab'); await pg.waitForTimeout(100);
      console.log('blur err:', await pg.$$eval('#sheet .err:not([hidden])', e => e.map(x => x.textContent)));
      await pg.fill('#sheet [name=purpose]', 'abc'); await pg.waitForTimeout(100);
      console.log('after edit:', await pg.$$eval('#sheet .err:not([hidden])', e => e.map(x => x.textContent)));
      await pg.keyboard.press('Escape');
      // export
      await pg.evaluate(() => location.hash = 'reports'); await pg.waitForTimeout(200);
      const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 30000 }), pg.click('[data-act=export]')]);
      await dl.saveAs('ui_export.xlsx'); console.log('download', dl.suggestedFilename());
    }
    if (w === 375) { await pg.evaluate(() => location.hash = 'overview'); await pg.click('.top .menu'); await pg.waitForTimeout(300); await pg.screenshot({ path: '375-nav.png'.replace(/^/, 'shots/') }); }
  }
  console.log('ERRORS', errors);
  await b.close();
})();
