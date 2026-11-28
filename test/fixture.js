// Shared test harness: opens ../index.html with a fake Supabase backend and fixed "today" = 2026-11-24 (Asia/Ho_Chi_Minh).
// Fixture data is invented for tests only — not shop records.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const settings = { employees: ['Thành', 'Thái', 'Bình'], kpi_target: 450, rate_low: 5000, rate_high: 10000 };
const expenses = [
  { id: 'e1', date: '2026-11-03', amount: 120000, category: 'Chi theo đơn hàng', purpose: 'Ship vợt cho khách', detail: 'Giao nội thành', invoice: '0012', transfer_code: '', sales_order_code: 'DH-0012', evidence: [], created_at: '2026-11-03T03:00:00Z' },
  { id: 'e2', date: '2026-11-10', amount: 45000, category: 'Mua dụng cụ', purpose: 'Mua kéo cắt dây', detail: '', invoice: '', transfer_code: '', sales_order_code: '', evidence: [], created_at: '2026-11-10T03:00:00Z' }
];
const strings = () => [
  { date: '2026-11-01', counts: { Thành: 4, Thái: 2 } },
  { date: '2026-11-02', counts: { Thành: 6, Thái: 1, Bình: 3 } },
  { date: '2026-11-24', counts: { Thành: 1 } }
];
const deposits = [{ id: 'd1', customer: 'Khách thử', phone: '0900000000', contact_platform: 'Zalo', contact_handle: '', category: 'Vợt', product: 'Vợt mẫu', variant: '4U', quantity: 1, date: '2026-11-20', amount: 300000, status: 'Đang chờ', closed_date: null, note: '' }];

async function openApp({ width = 375, height = 812, mobile = true, dark = false, failWrites = false, hash = 'overview', browser } = {}) {
  const b = browser || await chromium.launch();
  const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, timezoneId: 'Asia/Ho_Chi_Minh', colorScheme: dark ? 'dark' : 'light' });
  await ctx.addInitScript(() => {
    const exp = Math.floor(Date.now() / 1000) + 36000;
    localStorage.setItem('sb-jlwayvnokaxiapfaozew-auth-token', JSON.stringify({ access_token: 'x.eyJzdWIiOiJ1MSJ9.y', token_type: 'bearer', expires_in: 36000, expires_at: exp, refresh_token: 'r', user: { id: 'u1', email: 'test@shop.vn', aud: 'authenticated', role: 'authenticated' } }));
  });
  const supa = fs.readFileSync(require.resolve('@supabase/supabase-js/dist/umd/supabase.js'));
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'application/javascript', body: supa }));
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.route('http://app.test/**', r => r.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(__dirname, '../index.html')) }));
  const writes = [], data = { settings: [settings], budgets: [{ amount: 500000 }], expenses, strings: strings(), deposits, members: [{ email: 'test@shop.vn' }] };
  await ctx.route('https://jlwayvnokaxiapfaozew.supabase.co/**', async r => {
    const req = r.request(), p = new URL(req.url()).pathname, single = (req.headers()['accept'] || '').includes('pgrst.object');
    const json = (d, st = 200) => r.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(d), headers: { 'access-control-allow-origin': '*' } });
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (p.endsWith('/rpc/is_member')) return json(true);
    if (req.method() !== 'GET' && p.startsWith('/rest/')) {
      const body = req.postDataJSON?.();
      writes.push([req.method(), p, body]);
      if (failWrites) return json({ message: 'Failed to fetch' }, 500);
      return json(single ? (Array.isArray(body) ? body[0] : body) : (body ? [].concat(body) : []));
    }
    const rows = data[p.split('/').pop()];
    if (rows) return json(single ? rows[0] : rows);
    if (p.startsWith('/auth/')) return json({});
    return json({ message: 'unmocked ' + p }, 404);
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-11-24T12:00:00+07:00'));
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://app.test/#' + hash);
  await page.waitForSelector('main .head');
  return { page, writes, errors, close: () => (browser ? ctx.close() : b.close()) };
}

module.exports = { openApp, chromium };
