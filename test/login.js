const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const errs = [];
 for (const w of [375, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 760 } });
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync('node_modules/@supabase/supabase-js/dist/umd/supabase.js') }));
  await ctx.route('http://app.test/**', r => r.fulfill({ contentType: 'text/html', body: fs.readFileSync('../index.html') }));
  await ctx.route('https://jlwayvnokaxiapfaozew.supabase.co/**', r => r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials', code: 400, msg: 'Invalid login credentials' }), headers: { 'access-control-allow-origin': '*' } }));
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://app.test/'); await pg.waitForSelector('#login');
  await pg.fill('[name=email]', 'a@b.vn'); await pg.fill('[name=password]', 'x'); await pg.click('#login [type=submit]');
  await pg.waitForSelector('.form-err'); console.log(w, await pg.textContent('.form-err'));
  await pg.screenshot({ path: `shots/${w}-login.png` });
 }
 console.log('errors', errs); await b.close(); })();
