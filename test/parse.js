// node extract-builder.js && node parse.js — parser check on real OCR output of the 4 sample screenshots.
const assert = require('assert');
const { parseDepositText: p } = require('./builder.js');
const T = '2026-11-13';

let o = p('Pham Huy Nam đặt Fang 2 size 42.5 nan\nNGƯỜ O Không cónhómchung\nGiày cầu » Mizuno Wave Fang 2\n716A231351\nSize425\nCọc 200k\n1535\nđã nhận 200k cọc Tiền mặt\n1835\n', T);
assert.deepStrictEqual([o.customer, o.product, o.variant, o.amount, o.category, o.date, o.note], ['Pham Huy Nam', 'Fang 2', 'size 42.5', 200000, 'Giày', undefined, 'Tiền mặt']);

o = p('Alex Nguyen ( mizuno fang 2 size 40.5) nan\nSze40.5\n500.000\nL HN\nĐã nhận cọc 500k\n', T);
assert.deepStrictEqual([o.customer, o.product, o.variant, o.amount], ['Alex Nguyen', 'mizuno fang 2', 'size 40.5', 500000]);

// price quoted in chat (1743k) and promo prices are not a deposit
o = p('18:52 mm\nVĩ Hồ =\n§ Tên : Hồ Nguyên Vĩ\nsdt: 0934878510\nĐịa chỉ : 27 chu mạnh trinh , phường\nCầm Lệ , Đà Nẵng\n1 đôi mizuno wave fang 2 màu này\n1743k chưa bao gồm ship a nhé\n$ size 40\nCòn 1.743k\n', T);
assert.deepStrictEqual([o.customer, o.phone, o.product, o.variant, o.amount, o.note], ['Hồ Nguyên Vĩ', '0934878510', 'mizuno wave fang 2 màu này', 'size 40', undefined, 'Địa chỉ: 27 chu mạnh trinh, phường Cầm Lệ, Đà Nẵng']);

// OCR misreads the month as 71: the date must be dropped, not guessed
o = p('15:01 si\n‹ Hoàng Trung Hiều qãm F=\nChuyển tiền thành công M\n500,000 VND\n12/71/2026 14T)\n', T);
assert.deepStrictEqual([o.customer, o.amount, o.date, o.note], ['Hoàng Trung Hiều', 500000, undefined, 'Chuyển khoản']);

assert.strictEqual(p('12/11/2026 14:11\n', T).date, '2026-11-12');
assert.strictEqual(p('14/11/2026\n', T).date, undefined); // future
assert.strictEqual(p('cọc 1.5tr\n', T).amount, 1500000);
console.log('parse ok');
