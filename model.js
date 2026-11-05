// Mô hình dự báo pin. Thuần logic, không đụng tới giao diện.

export const SOURCES = {
  measured: "Đo thực tế",
  osm: "Bản đồ OSM",
  maps: "Google Maps",
  reported: "Bạn cung cấp",
  estimate: "Ước tính, chưa xác minh",
  none: "Chưa có km",
};
export const TRAFFIC = { clear: "Thông thoáng", normal: "Bình thường", busy: "Hơi đông", jam: "Đông / kẹt" };
export const isHeavy = (t) => t === "busy" || t === "jam";

const num = (v) => (v === "" || v == null || !isFinite(Number(v)) ? null : Number(v));

/** % pin tiêu hao của một lần đo, hoặc null nếu chưa đủ dữ liệu. */
export function usedOf(l) {
  const s = num(l.pinStart), e = num(l.pinEnd);
  if (s != null && e != null) return s - e;
  return num(l.used);
}

/** Lần đo có được dùng để tính %/km không. */
export function usable(l, includeEstimates = false) {
  const u = usedOf(l), km = num(l.km);
  if (u == null || !(u > 0) || !(km > 0)) return false;
  if (l.kmSource === "estimate" && !includeEstimates) return false;
  return true;
}

function groupRate(pts, pred) {
  const g = pts.filter(pred);
  const km = g.reduce((s, l) => s + Number(l.km), 0);
  return { n: g.length, rate: g.length >= 2 && km > 0 ? g.reduce((s, l) => s + usedOf(l), 0) / km : null };
}

/** Tóm tắt mô hình từ toàn bộ lần đo. */
export function buildModel(legs, { includeEstimates = false } = {}) {
  const pts = legs.filter((l) => usable(l, includeEstimates));
  const sumU = pts.reduce((s, l) => s + usedOf(l), 0);
  const sumK = pts.reduce((s, l) => s + Number(l.km), 0);
  const rates = pts.map((l) => usedOf(l) / Number(l.km));
  const sp = legs.filter((l) => num(l.km) > 0 && num(l.durationMin) > 0 && (l.kmSource !== "estimate" || includeEstimates));
  const spK = sp.reduce((s, l) => s + Number(l.km), 0), spM = sp.reduce((s, l) => s + Number(l.durationMin), 0);
  return {
    pts, sumU, sumK,
    R: sumK > 0 ? sumU / sumK : null,
    min: rates.length ? Math.min(...rates) : null,
    max: rates.length ? Math.max(...rates) : null,
    heavy: groupRate(pts, (l) => isHeavy(l.traffic)),
    light: groupRate(pts, (l) => !isHeavy(l.traffic) && !l.bridge),
    bridge: groupRate(pts, (l) => !!l.bridge),
    speed: spM > 0 ? spK / (spM / 60) : null,
    speedN: sp.length,
  };
}

/* ---------- so khớp địa điểm ---------- */
export const normText = (s) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, " ").trim();

export function distM(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Hai điểm có phải cùng một nơi không: theo tọa độ (≤150 m) nếu cả hai có, không thì theo địa chỉ/tên. */
export function samePlace(p, q) {
  if (!p || !q) return false;
  if (p.lat != null && q.lat != null) return distM(p, q) <= 150;
  const a = normText(p.addr || p.name), b = normText(q.addr || q.name);
  return !!a && a === b;
}

export function historyFor(legs, from, to) {
  return legs.filter((l) => usedOf(l) != null && samePlace(l.from, from) && samePlace(l.to, to));
}

/* ---------- dự báo ---------- */
const fmt2 = (n) => n.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Dự báo một chặng. Trả về % tiêu hao cho 3 kịch bản và lý do. */
export function forecastLeg(M, legs, pl, from, to) {
  const basis = [];
  const hist = historyFor(legs, from, to);
  if (hist.length) {
    const us = hist.map(usedOf), avg = us.reduce((a, b) => a + b, 0) / us.length;
    const lo = M.R && M.min ? M.min / M.R : 0.9, hi = M.R && M.max ? M.max / M.R : 1.15;
    basis.push(`Đã đi chặng này ${hist.length} lần, tiêu hao thực tế ${us.map((u) => Math.round(u) + "%").join(", ")}`);
    return { ok: true, hist: true, fav: Math.min(...us, avg * lo), norm: avg, adv: Math.max(...us, avg * hi), basis };
  }
  const km = num(pl.km);
  if (!(km > 0)) return { ok: false, basis: ["Thiếu quãng đường: bấm “Tra km” hoặc nhập tay"] };
  if (M.R == null) return { ok: false, basis: ["Chưa có lần đo nào có km để tính"] };
  const heavy = isHeavy(pl.traffic);
  let rate = M.R;
  if (pl.bridge && M.bridge.rate != null) { rate = M.bridge.rate; basis.push(`Có cầu: dùng mức của ${M.bridge.n} chặng có cầu (${fmt2(rate)}%/km)`); }
  else if (heavy && M.heavy.rate != null) { rate = M.heavy.rate; basis.push(`Đường đông: dùng mức của ${M.heavy.n} chặng đông (${fmt2(rate)}%/km)`); }
  else if (!heavy && !pl.bridge && M.light.rate != null) { rate = M.light.rate; basis.push(`Đường không đông, không cầu: dùng mức của ${M.light.n} chặng tương tự (${fmt2(rate)}%/km)`); }
  else if (heavy || pl.bridge) { rate = (M.R + M.max) / 2; basis.push(`${pl.bridge ? "Có cầu" : "Đường đông"} nhưng chưa đủ 2 chặng tương tự: lấy giữa mức gộp và mức cao nhất (${fmt2(rate)}%/km)`); }
  else basis.push(`Mức gộp ${fmt2(rate)}%/km từ ${M.pts.length} lần đo có km`);
  if (pl.kmSource === "estimate") basis.push("Số km là ước tính, độ tin cậy thấp");
  return { ok: true, fav: km * M.min, norm: km * rate, adv: km * M.max * (heavy || pl.bridge ? 1.1 : 1), basis };
}

/** Dự báo cả lịch trình. startPin có thể null (chưa biết). */
export function forecastPlan(legs, plan, settings = {}) {
  const M = buildModel(legs, settings);
  const start = num(plan.startPin);
  const rows = plan.legs.map((pl, i) => {
    const a = plan.stops[i] || {}, b = plan.stops[i + 1] || {};
    const f = forecastLeg(M, legs, pl, a, b);
    let min = null;
    if (num(pl.mapsMin) > 0) min = [Math.round(num(pl.mapsMin)), Math.round(num(pl.mapsMin) * 1.25)];
    else if (num(pl.km) > 0 && M.speed) { const m = (num(pl.km) / M.speed) * 60; min = [Math.round(m), Math.round(m * 1.25)]; }
    return { i, a, b, pl, f, min };
  });
  const complete = rows.length > 0 && rows.every((r) => r.f.ok);
  const total = { fav: 0, norm: 0, adv: 0 };
  rows.forEach((r) => {
    if (!r.f.ok) return;
    for (const k of ["fav", "norm", "adv"]) {
      total[k] += r.f[k];
      r.cum = r.cum || {};
      r.cum[k] = total[k];
    }
    if (start != null) r.after = { fav: start - r.cum.fav, norm: start - r.cum.norm, adv: start - r.cum.adv };
  });
  const reserve = num(settings.reserve) ?? 20;
  const needed = complete ? { norm: Math.ceil(total.norm + reserve), adv: Math.ceil(total.adv + reserve) } : null;
  const end = complete && start != null ? { fav: start - total.fav, norm: start - total.norm, adv: start - total.adv } : null;
  return {
    M, rows, complete, total: complete ? total : null, end, needed, start, reserve,
    km: rows.reduce((s, r) => s + (num(r.pl.km) > 0 ? num(r.pl.km) : 0), 0),
    kmAll: rows.every((r) => num(r.pl.km) > 0),
  };
}

/** Kết luận mục D. */
export function verdict(F) {
  if (!F.complete) return { level: "unknown", text: "Chưa đánh giá được vì còn chặng thiếu quãng đường và chưa từng đi." };
  if (!F.end) return { level: "unknown", text: `Cần biết pin lúc xuất phát. Nên có ít nhất ${F.needed.norm}% (điều kiện bình thường) hoặc ${F.needed.adv}% (nếu gặp đường đông) để đến nơi còn ${F.reserve}%.` };
  const n = F.end.norm, a = F.end.adv, res = F.reserve, r = Math.round;
  if (a >= res) return { level: "ok", text: `Đủ pin. Kể cả khi bất lợi vẫn còn khoảng ${r(a)}%. Không cần sạc giữa đường.` };
  if (n >= res) return { level: "warn", text: `Nhiều khả năng đủ pin (thường còn khoảng ${r(n)}%). Nếu đường đông có thể xuống ${r(Math.max(a, 0))}%, dưới mức dự phòng ${res}%. Theo dõi pin sau mỗi chặng.` };
  if (n >= 5) return { level: "warn", text: `Sát. Mức thường chỉ còn khoảng ${r(n)}%, dưới mức dự phòng ${res}%. Nên sạc ở một điểm dừng dài.` };
  return { level: "bad", text: "Không đủ an toàn. Dự báo hết hoặc gần hết pin trước khi xong lịch trình. Cần sạc giữa đường." };
}

/** Thống kê dự báo so với thực tế. */
export function calibration(legs) {
  const pr = legs.filter((l) => num(l.predicted) != null && usedOf(l) != null);
  if (!pr.length) return null;
  const devs = pr.map((l) => usedOf(l) - num(l.predicted));
  return {
    n: pr.length,
    mean: devs.reduce((a, b) => a + b, 0) / devs.length,
    mae: devs.reduce((a, b) => a + Math.abs(b), 0) / devs.length,
  };
}
