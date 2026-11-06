import { SOURCES, TRAFFIC, SHORT_KM, usedOf, usable, forecastPlan, verdict, calibration, buildModel, journeyToLegs } from "./model.js";
import { searchPlace, route, googleMapsLink } from "./maps.js";
import { load, save, validateImport } from "./store.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n, d = 1) => (n == null || !isFinite(n) ? "—" : Number(n).toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d }));
const r0 = (v) => Math.round(v);
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const dmy = (s) => (s ? s.split("-").reverse().join("/") : "—");

/* ---------- trạng thái ---------- */
const blankStop = () => ({ name: "", addr: "", lat: null, lon: null, label: "", time: "" });
const blankLeg = () => ({ km: "", kmSource: "osm", mapsMin: "", traffic: "normal", bridge: false, route: "" });
const emptyPlan = () => ({ date: "", startPin: "", stops: [blankStop(), blankStop()], legs: [blankLeg()] });

let state = { legs: [], plan: emptyPlan(), settings: { reserve: 20, includeEstimates: false } };
const ui = { results: {}, searching: {}, routes: {}, routing: {}, pickOnMap: null, logMode: "journey", logDraft: null, journey: null, jRouting: null, editId: null, confirmDel: null, confirmClear: false };

// Lưu ngay mỗi lần thay đổi, lần lượt từng lần (người dùng có thể tắt app bất cứ lúc nào).
let saving = Promise.resolve();
function persist() { saving = saving.then(() => save(state)).catch(() => {}); return saving; }
function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2600); }

/* ---------- bản đồ ---------- */
let map = null, mapLayer = null;
function initMap() {
  if (!window.L) { $("#map").innerHTML = '<p class="small muted" style="padding:12px">Không tải được bản đồ.</p>'; return; }
  map = L.map("map", { zoomControl: false, attributionControl: true }).setView([10.78, 106.69], 12);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
  mapLayer = L.layerGroup().addTo(map);
  map.on("click", (e) => {
    const i = ui.pickOnMap;
    if (i == null || !state.plan.stops[i]) return;
    const lat = Math.round(e.latlng.lat * 1e6) / 1e6, lon = Math.round(e.latlng.lng * 1e6) / 1e6;
    Object.assign(state.plan.stops[i], { lat, lon, approx: false, label: `Điểm chọn trên bản đồ (${lat.toFixed(5)}, ${lon.toFixed(5)})` });
    ui.pickOnMap = null; ui.results[i] = undefined; delete ui.routes[i - 1]; delete ui.routes[i];
    persist(); renderPlan(); toast("Đã đặt vị trí. Bấm “Tra km” ở chặng tương ứng.");
  });
}
function drawMap() {
  if (!map) return;
  mapLayer.clearLayers();
  const pts = [];
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#0f6b55";
  state.plan.stops.forEach((s, i) => {
    if (s.lat == null) return;
    pts.push([s.lat, s.lon]);
    L.circleMarker([s.lat, s.lon], { radius: 9, color: accent, fillColor: accent, fillOpacity: 1, weight: 2 })
      .bindTooltip(i === 0 ? "A" : String(i), { permanent: true, direction: "center", className: "" })
      .addTo(mapLayer);
  });
  state.plan.legs.forEach((pl, i) => {
    const alts = ui.routes[i];
    if (!alts) return;
    const sel = alts[pl.altIndex ?? 0];
    if (sel?.geometry) L.geoJSON(sel.geometry, { style: { color: "#2b7de9", weight: 5, opacity: 0.85 } }).addTo(mapLayer);
  });
  $("#map").classList.toggle("picking", ui.pickOnMap != null);
  if (ui.pickOnMap == null) {
    if (pts.length === 1) map.setView(pts[0], 14);
    else if (pts.length > 1) map.fitBounds(pts, { padding: [28, 28] });
  }
  setTimeout(() => map.invalidateSize(), 50);
}

/* ---------- Dự báo ---------- */
function battBar(v) {
  const w = Math.max(0, Math.min(100, v));
  const c = v < 10 ? "var(--bad)" : v < state.settings.reserve ? "var(--warn)" : "var(--ok)";
  return `<div class="batt" aria-hidden="true"><i style="width:${w}%;background:${c}"></i></div>`;
}

function stopHTML(s, i) {
  const res = ui.results[i];
  return `<div class="stop"><div class="dot">${i === 0 ? "A" : i}</div><div class="stopf">
    <div class="row">
      <label>${i === 0 ? "Điểm xuất phát" : "Điểm dừng " + i}<input id="s-name-${i}" data-stop="${i}" data-f="name" value="${esc(s.name)}" placeholder="Tên (vd: Nhà, sân Green)"></label>
      <label style="flex:0 1 104px">${i === 0 ? "Giờ đi" : "Giờ rời"}<input id="s-time-${i}" data-stop="${i}" data-f="time" type="time" value="${esc(s.time)}"></label>
    </div>
    <div class="row">
      <label style="flex:1 1 200px">Địa chỉ hoặc tên địa điểm<input id="s-addr-${i}" data-stop="${i}" data-f="addr" value="${esc(s.addr)}" placeholder="vd: Co.opmart Huỳnh Tấn Phát" enterkeyhint="search"></label>
      <button class="btn sm" data-act="search" data-i="${i}" type="button"${ui.searching[i] ? " disabled" : ""}>${ui.searching[i] ? "Đang tìm…" : "Tìm"}</button>
    </div>
    <div class="actions">
      <button class="btn sm" data-act="map-pick" data-i="${i}" type="button"${ui.pickOnMap === i ? ' aria-pressed="true"' : ""}>${ui.pickOnMap === i ? "Đang chờ chạm bản đồ… (bấm để huỷ)" : "Chạm chọn trên bản đồ"}</button>
      ${state.plan.stops.length > 2 ? `<button class="btn sm danger" data-act="stop-del" data-i="${i}" type="button" aria-label="Xoá điểm ${i}">Xoá điểm</button>` : ""}
    </div>
    ${s.lat != null ? `<p class="resolved"><b>✓ Đã định vị:</b> ${esc(s.label || s.addr)}${s.approx ? ' <span class="chip k-estimate">gần đúng</span>' : ""}</p>` : s.addr ? `<p class="resolved">Chưa định vị. Bấm “Tìm” hoặc chạm chọn trên bản đồ.</p>` : ""}
    ${res ? (res.list.length ? `${res.approx ? `<p class="hint warn">Không tìm thấy đúng số nhà. Các kết quả dưới đây chỉ khớp tên đường, có thể lệch vài km. Nên gõ tên cửa hàng/trường/toà nhà, hoặc chạm chọn trên bản đồ.</p>` : ""}
        <div class="results">${res.list.map((r, k) => `<button type="button" data-act="pick" data-i="${i}" data-k="${k}">${r.approx && !res.approx ? "≈ " : ""}${esc(r.label)}</button>`).join("")}</div>`
      : `<p class="hint warn">Không tìm thấy. Thử gõ tên địa điểm (vd “Co.opmart Huỳnh Tấn Phát”), bỏ chữ “Quận…”, hoặc chạm chọn trên bản đồ.</p>`) : ""}
  </div></div>`;
}

function legHTML(pl, i, r) {
  const a = state.plan.stops[i], b = state.plan.stops[i + 1];
  const gm = googleMapsLink(a, b), alts = ui.routes[i];
  const canRoute = a.addr || a.lat != null ? (b.addr || b.lat != null) : false;
  return `<div class="leg">
    <div class="row" style="justify-content:space-between;align-items:center"><h3>Chặng ${i + 1}</h3>
      <div class="actions">
        <button class="btn sm primary" data-act="route" data-i="${i}" type="button"${!canRoute || ui.routing[i] ? " disabled" : ""}>${ui.routing[i] ? "Đang tra…" : "Tra km"}</button>
        ${gm ? `<a class="btn sm" href="${esc(gm)}" target="_blank" rel="noopener">Google Maps ↗</a>` : ""}
      </div></div>
    ${alts ? `<div class="alts" role="group" aria-label="Chọn tuyến">${alts.map((t, k) => `<button type="button" class="alt" data-act="alt" data-i="${i}" data-k="${k}" aria-pressed="${(pl.altIndex ?? 0) === k}">${k === 0 ? "Tuyến chính" : "Tuyến " + (k + 1)}: ${fmt(t.km)} km · ${t.min}′</button>`).join("")}</div>` : ""}
    <div class="row">
      <label>Km<input id="l-km-${i}" class="num" data-leg="${i}" data-f="km" type="number" inputmode="decimal" step="0.1" min="0" value="${esc(pl.km)}"></label>
      <label>Phút (bản đồ)<input id="l-min-${i}" class="num" data-leg="${i}" data-f="mapsMin" type="number" inputmode="numeric" min="0" value="${esc(pl.mapsMin)}"></label>
      <label>Nguồn km<select id="l-src-${i}" data-leg="${i}" data-f="kmSource">${["osm", "maps", "measured", "estimate"].map((k) => `<option value="${k}"${pl.kmSource === k ? " selected" : ""}>${SOURCES[k]}</option>`).join("")}</select></label>
    </div>
    <div class="row">
      <label>Giao thông<select id="l-tr-${i}" data-leg="${i}" data-f="traffic">${Object.entries(TRAFFIC).map(([k, v]) => `<option value="${k}"${pl.traffic === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>
      <label class="check" style="flex:0 0 auto"><input id="l-br-${i}" data-leg="${i}" data-f="bridge" type="checkbox"${pl.bridge ? " checked" : ""}>Có cầu / dốc</label>
    </div>
    <label>Tuyến dự định<input id="l-route-${i}" data-leg="${i}" data-f="route" value="${esc(pl.route)}" placeholder="vd: Điện Biên Phủ → Nguyễn Bỉnh Khiêm"></label>
    <div class="hint ${r.f.ok ? "" : "warn"}">${r.f.ok ? `Dự báo tốn <b class="num">${r0(r.f.fav)}–${r0(r.f.adv)}%</b>, thường khoảng <b class="num">${r0(r.f.norm)}%</b>. ` : ""}${r.f.basis.map(esc).join(". ")}.</div>
    <button class="btn sm" data-act="log-from-plan" data-i="${i}" type="button">Ghi pin thực tế chặng này</button>
  </div>`;
}

function renderPlan() {
  const p = state.plan, F = forecastPlan(state.legs, p, state.settings), V = verdict(F);
  let h = `<div class="card"><div class="row" style="justify-content:space-between;align-items:center"><h2>Lịch trình</h2>
      <button class="btn sm" data-act="plan-clear" type="button">${ui.confirmClear ? "Bấm lần nữa để xoá" : "Lịch trình mới"}</button></div>
    <div class="row">
      <label>Ngày đi<input id="p-date" type="date" value="${esc(p.date)}"></label>
      <label>Pin lúc xuất phát (%)<input id="p-start" class="num" type="number" inputmode="numeric" min="0" max="100" value="${esc(p.startPin)}" placeholder="bắt buộc"></label>
    </div>`;
  p.stops.forEach((s, i) => { h += stopHTML(s, i); if (i < p.legs.length) h += legHTML(p.legs[i], i, F.rows[i]); });
  h += `<button class="btn" data-act="stop-add" type="button">+ Thêm điểm dừng</button>
    <p class="small muted">Km và phút lấy từ bản đồ OpenStreetMap (tính cho xe chạy bình thường, chưa tính kẹt xe). Có thể bấm Google Maps để đối chiếu.</p></div>`;

  const tm = F.rows.length && F.rows.every((r) => r.min) ? [F.rows.reduce((s, r) => s + r.min[0], 0), F.rows.reduce((s, r) => s + r.min[1], 0)] : null;
  h += `<div class="card"><h2>A. Tổng quan</h2><div class="stats">
    <div class="stat"><span class="l">Tổng quãng đường</span><span class="v">${F.km > 0 ? fmt(F.km) + " km" : "—"}</span><span class="small muted">${F.kmAll ? "đủ km các chặng" : "còn chặng thiếu km"}</span></div>
    <div class="stat"><span class="l">Số chặng</span><span class="v">${F.rows.length}</span></div>
    <div class="stat"><span class="l">Thời gian chạy</span><span class="v">${tm ? `${tm[0]}–${tm[1]}′` : "—"}</span><span class="small muted">${tm ? "có cộng 25% dự phòng" : "cần số phút"}</span></div>
    <div class="stat"><span class="l">Pin xuất phát</span><span class="v">${F.start != null ? fmt(F.start, 0) + "%" : "?"}</span><span class="small muted">${F.start != null ? "" : "chưa nhập"}</span></div>
  </div></div>`;

  h += `<div class="card"><h2>B. Từng chặng</h2><div class="tablewrap"><table><thead><tr><th>Chặng</th><th class="r">Km</th><th class="r">Phút</th><th class="r">Tốn</th><th class="r">Còn</th></tr></thead><tbody>`;
  F.rows.forEach((r) => {
    h += `<tr><td class="legname">${r.i + 1}. ${esc(r.a.name || r.a.addr || "?")} → ${esc(r.b.name || r.b.addr || "?")}</td>
      <td class="r num">${Number(r.pl.km) > 0 ? fmt(r.pl.km) : "—"}</td><td class="r num">${r.min ? r.min[0] + "–" + r.min[1] : "—"}</td>
      <td class="r num">${r.f.ok ? r0(r.f.norm) + "%" : "—"}</td><td class="r num">${r.after ? r0(r.after.norm) + "%" : r.cum ? "−" + r0(r.cum.norm) + "%" : "—"}</td></tr>`;
  });
  h += `</tbody></table></div>${F.start == null && F.complete ? `<p class="small muted">Chưa có pin xuất phát nên cột “Còn” ghi tổng % đã tốn.</p>` : ""}</div>`;

  if (F.complete) {
    const col = (k, t, d) => {
      const fin = F.end ? F.end[k] : null;
      return `<div class="s"><h3>${t}</h3><p class="small muted">${d}</p>
        <span class="end">${fin != null ? r0(fin) + "%" : "−" + r0(F.total[k]) + "%"}</span>${fin != null ? battBar(fin) : ""}
        <div class="small legs" style="font-variant-numeric:tabular-nums">${F.rows.map((r) => `Sau chặng ${r.i + 1}: ${r.after ? r0(r.after[k]) + "%" : "−" + r0(r.cum[k]) + "%"}`).join(" · ")}</div></div>`;
    };
    h += `<div class="card"><h2>C. Ba kịch bản</h2><div class="scen">${col("fav", "Thuận lợi", "Đường thoáng, ít dừng.")}${col("norm", "Bình thường", "Như bạn hay đi.")}${col("adv", "Bất lợi", "Đông, dừng nhiều, cầu dốc.")}</div>
      <p class="small muted">${F.end ? "Số lớn là pin còn lại khi đến điểm cuối; dòng nhỏ là pin sau từng chặng." : "Chưa có pin xuất phát: các số là % pin sẽ tốn."}</p></div>`;
  }
  const label = { ok: "Đủ pin", warn: "Cần chú ý", bad: "Cần sạc", unknown: "Chưa đủ dữ liệu" }[V.level];
  h += `<div class="card"><h2>D. Đánh giá</h2><p><span class="pill ${V.level}">${label}</span></p><p>${esc(V.text)}</p>
    ${F.needed ? `<p class="small">Pin tối thiểu nên có khi đi: <b class="num">${Math.min(100, F.needed.norm)}%</b> (bình thường) · <b class="num">${Math.min(100, F.needed.adv)}%</b> (nếu đường đông). ${F.needed.adv > 100 ? "Đi giờ đông thì một lần sạc đầy có thể không đủ để giữ mức dự phòng." : ""}</p>` : ""}
    <p class="small muted">Mức dự phòng: ${state.settings.reserve}% (đổi trong tab Hồ sơ). Đây là ước tính từ dữ liệu của chính xe bạn.</p></div>`;

  const need = [];
  if (F.start == null) need.push("Pin lúc xuất phát.");
  F.rows.forEach((r) => {
    if (!r.f.ok) need.push(`Chặng ${r.i + 1}: quãng đường (bấm “Tra km”).`);
    else if (!r.f.hist && r.pl.kmSource === "estimate") need.push(`Chặng ${r.i + 1}: thay km ước tính bằng số trên bản đồ.`);
  });
  p.stops.forEach((s, i) => { if (s.addr && s.lat == null) need.push(`${i === 0 ? "Điểm xuất phát" : "Điểm " + i}: bấm “Tìm” để xác nhận đúng địa điểm.`); });
  h += `<div class="card"><h2>E. Cần bổ sung</h2>${need.length ? `<ul class="clean">${need.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "<p>Đủ thông tin. Đi xong mỗi chặng, bấm “Ghi pin thực tế chặng này”.</p>"}</div>`;
  $("#planBody").innerHTML = h;
  drawMap();
}

/* ---------- Ghi chặng ---------- */
const newDraft = () => ({ date: today(), order: 1, from: blankStop(), to: blankStop(), route: "", km: "", kmSource: "osm", pinStart: "", pinEnd: "", traffic: "normal", bridge: false, durationMin: "", predicted: "", note: "" });
function renderLog() {
  const seg = `<div class="seg" role="group" aria-label="Cách ghi">
      <button type="button" data-act="mode-journey" aria-pressed="${ui.logMode === "journey"}">Cả hành trình</button>
      <button type="button" data-act="mode-single" aria-pressed="${ui.logMode !== "journey"}">Một chặng</button></div>`;
  $("#view-log").innerHTML = seg + (ui.logMode === "journey" ? journeyHTML() : singleLogHTML());
}

/* ---------- Ghi cả hành trình ---------- */
const blankJStop = () => ({ name: "", addr: "", lat: null, lon: null, label: "", pin: "", arrive: "", leave: "", km: "", kmSource: "osm", traffic: "normal", bridge: false });
const newJourney = () => ({ date: today(), note: "", stops: [blankJStop(), blankJStop()] });

function journeyPreview(j) {
  try {
    const legs = journeyToLegs(j);
    return { legs, html: `<div class="preview">${legs.map((l) => {
      const u = l.pinStart - l.pinEnd;
      if (u <= 0) return `<p class="hint warn">${esc(l.from.name || "?")} → ${esc(l.to.name || "?")}: pin không giảm (${l.pinStart}→${l.pinEnd}%). Có sạc giữa đường không? Kiểm tra lại số; chặng này sẽ không được tính vào mô hình.</p>`;
      return `<div class="pv"><span>${esc(l.from.name || l.from.addr || "?")} → ${esc(l.to.name || l.to.addr || "?")}${l.via.length ? `<br><span class="small muted">qua ${l.via.map((v) => esc(v.name || v.addr || "?")).join(", ")} (không biết pin ở đó)</span>` : ""}</span>
        <span class="num" style="text-align:right">${l.pinStart}→${l.pinEnd}% · <b>${u}%</b><br><span class="small muted">${l.km ? `${fmt(l.km)} km · ${fmt(u / l.km, 2)}%/km` : "chưa đủ km"}${l.durationMin ? ` · ${l.durationMin}′` : ""}</span></span></div>`;
    }).join("")}</div>` };
  } catch (e) { return { legs: null, html: `<p class="hint warn">${esc(e.message)}</p>` }; }
}

function journeyHTML() {
  if (!ui.journey) ui.journey = newJourney();
  const j = ui.journey, n = j.stops.length;
  const pv = journeyPreview(j);
  let h = `<div class="card"><h2>Ghi cả hành trình</h2>
    <p class="small muted">Ghi các điểm đã đi theo thứ tự. Điểm nào quên xem pin thì để trống: app tự gộp chặng qua điểm đó.</p>
    <div class="row"><label>Ngày<input id="j-date" data-j="date" type="date" value="${esc(j.date)}"></label>
      <button class="btn sm" type="button" data-act="j-from-plan">Lấy điểm từ lịch trình</button></div>`;
  j.stops.forEach((s, i) => {
    if (i > 0) {
      h += `<div class="jhop"><div class="row">
        <label>Km đoạn ${i}<input id="j-km-${i}" class="num" data-js="${i}" data-f="km" type="number" inputmode="decimal" step="0.1" min="0" value="${esc(s.km)}"></label>
        <label>Nguồn km<select id="j-src-${i}" data-js="${i}" data-f="kmSource">${["osm", "maps", "measured", "estimate"].map((k) => `<option value="${k}"${s.kmSource === k ? " selected" : ""}>${SOURCES[k]}</option>`).join("")}</select></label>
        <button class="btn sm" type="button" data-act="j-route" data-i="${i}"${ui.jRouting === i ? " disabled" : ""}>${ui.jRouting === i ? "Đang tra…" : "Tra km"}</button>
      </div><div class="row">
        <label>Giao thông<select id="j-tr-${i}" data-js="${i}" data-f="traffic">${Object.entries(TRAFFIC).map(([k, v]) => `<option value="${k}"${s.traffic === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>
        <label class="check" style="flex:0 0 auto"><input id="j-br-${i}" data-js="${i}" data-f="bridge" type="checkbox"${s.bridge ? " checked" : ""}>Có cầu / dốc</label>
      </div></div>`;
    }
    h += `<div class="jstop"><div class="dot">${i === 0 ? "A" : i}</div><div class="stopf">
      <div class="row">
        <label>${i === 0 ? "Xuất phát" : "Điểm " + i}<input id="j-name-${i}" data-js="${i}" data-f="name" value="${esc(s.name)}" placeholder="Tên"></label>
        <label style="flex:2 1 170px">Địa chỉ / tên địa điểm<input id="j-addr-${i}" data-js="${i}" data-f="addr" value="${esc(s.addr)}"></label>
      </div>
      <div class="row">
        <label>${i === 0 ? "Pin lúc đi (%)" : "Pin khi tới (%)"}<input id="j-pin-${i}" class="num" data-js="${i}" data-f="pin" type="number" inputmode="numeric" min="0" max="100" value="${esc(s.pin)}" placeholder="${i === 0 || i === n - 1 ? "bắt buộc" : "quên thì để trống"}"></label>
        ${i > 0 ? `<label style="flex:0 1 104px">Giờ tới<input id="j-arr-${i}" data-js="${i}" data-f="arrive" type="time" value="${esc(s.arrive)}"></label>` : ""}
        ${i < n - 1 ? `<label style="flex:0 1 104px">Giờ rời<input id="j-lv-${i}" data-js="${i}" data-f="leave" type="time" value="${esc(s.leave)}"></label>` : ""}
      </div>
      ${s.lat != null ? `<p class="resolved"><b>✓</b> ${esc(s.label)}</p>` : ""}
      ${n > 2 ? `<div><button class="btn sm danger" type="button" data-act="j-del" data-i="${i}">Xoá điểm này</button></div>` : ""}
    </div></div>`;
  });
  h += `<button class="btn" type="button" data-act="j-add">+ Thêm điểm</button>
    <label>Ghi chú chung<textarea id="j-note" data-j="note" rows="2">${esc(j.note)}</textarea></label>
    <h3>Sẽ lưu thành</h3>${pv.html}
    <div class="row"><button class="btn primary" type="button" data-act="j-save" style="flex:1"${pv.legs ? "" : " disabled"}>Lưu ${pv.legs ? pv.legs.length + " chặng" : ""}</button>
      <button class="btn" type="button" data-act="j-reset">Làm lại</button></div>
  </div>`;
  return h;
}

/** Tra km cho đoạn tới điểm i: chỉ tự định vị khi có đúng một kết quả chắc chắn. */
async function doJourneyRoute(i) {
  const j = ui.journey;
  ui.jRouting = i; renderLog();
  try {
    for (const k of [i - 1, i]) {
      const s = j.stops[k];
      if (s.lat != null) continue;
      const q = (s.addr || s.name || "").trim();
      if (!q) throw new Error(`Điểm ${k === 0 ? "xuất phát" : k}: nhập địa chỉ hoặc tên địa điểm trước.`);
      const res = await searchPlace(q);
      const sure = res.list.filter((r) => !r.approx);
      if (sure.length !== 1) throw new Error(`Không xác định chắc chắn “${q}”. Gõ tên địa điểm rõ hơn (vd “Crescent Mall”) hoặc nhập km tay.`);
      Object.assign(s, { lat: sure[0].lat, lon: sure[0].lon, label: sure[0].label });
    }
    const alts = await route(j.stops[i - 1], j.stops[i]);
    Object.assign(j.stops[i], { km: alts[0].km, kmSource: "osm" });
    toast(`Đoạn ${i}: ${fmt(alts[0].km)} km`);
  } catch (e) { toast(navigator.onLine ? e.message : "Không có mạng. Bạn vẫn nhập km tay được."); }
  ui.jRouting = null; renderLog();
}

function singleLogHTML() {
  if (!ui.logDraft) ui.logDraft = newDraft();
  const d = ui.logDraft;
  const used = d.pinStart !== "" && d.pinEnd !== "" ? Number(d.pinStart) - Number(d.pinEnd) : null;
  const dev = used != null && d.predicted !== "" ? used - Number(d.predicted) : null;
  return `<form id="logForm" class="card" novalidate><h2>Ghi kết quả một chặng</h2>
    <p class="small muted">Ghi ngay khi đến nơi: pin lúc đi, pin lúc đến, đường đông không, có lên cầu không.</p>
    <div class="row"><label>Ngày<input id="g-date" name="date" type="date" value="${esc(d.date)}"></label><label style="flex:0 1 110px">Chặng số<input id="g-order" class="num" name="order" type="number" inputmode="numeric" min="1" value="${esc(d.order)}"></label></div>
    <div class="row"><label>Từ<input id="g-fn" name="from.name" value="${esc(d.from.name)}" placeholder="Tên"></label><label style="flex:2 1 180px">Địa chỉ đi<input id="g-fa" name="from.addr" value="${esc(d.from.addr)}"></label></div>
    <div class="row"><label>Đến<input id="g-tn" name="to.name" value="${esc(d.to.name)}" placeholder="Tên"></label><label style="flex:2 1 180px">Địa chỉ đến<input id="g-ta" name="to.addr" value="${esc(d.to.addr)}"></label></div>
    <div class="row">
      <label>Pin lúc đi (%)<input id="g-ps" class="num" name="pinStart" type="number" inputmode="numeric" min="0" max="100" value="${esc(d.pinStart)}"></label>
      <label>Pin lúc đến (%)<input id="g-pe" class="num" name="pinEnd" type="number" inputmode="numeric" min="0" max="100" value="${esc(d.pinEnd)}"></label>
    </div>
    <div class="row">
      <label>Km<input id="g-km" class="num" name="km" type="number" inputmode="decimal" step="0.1" min="0" value="${esc(d.km)}" placeholder="trống nếu chưa biết"></label>
      <label>Nguồn km<select id="g-src" name="kmSource">${["osm", "maps", "measured", "estimate"].map((k) => `<option value="${k}"${d.kmSource === k ? " selected" : ""}>${SOURCES[k]}</option>`).join("")}</select></label>
    </div>
    <div class="row">
      <label>Giao thông<select id="g-tr" name="traffic">${Object.entries(TRAFFIC).map(([k, v]) => `<option value="${k}"${d.traffic === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>Chạy mất (phút)<input id="g-dur" class="num" name="durationMin" type="number" inputmode="numeric" min="0" value="${esc(d.durationMin)}"></label>
    </div>
    <div class="row">
      <label>Dự báo trước đó (% tốn)<input id="g-pred" class="num" name="predicted" type="number" inputmode="numeric" value="${esc(d.predicted)}" placeholder="nếu có"></label>
      <label class="check" style="flex:0 0 auto"><input id="g-br" name="bridge" type="checkbox"${d.bridge ? " checked" : ""}>Có cầu / dốc</label>
    </div>
    <label>Tuyến đã đi<input id="g-route" name="route" value="${esc(d.route)}"></label>
    <label>Ghi chú<textarea id="g-note" name="note" rows="2">${esc(d.note)}</textarea></label>
    <div class="hint ${dev != null && Math.abs(dev) >= 4 ? "warn" : used != null && used < 0 ? "bad" : ""}">${used == null ? "Nhập pin lúc đi và lúc đến để tính mức tiêu hao." : used < 0 ? "Pin lúc đến lớn hơn lúc đi. Kiểm tra lại (hoặc có sạc giữa chặng)." : `Tiêu hao <b class="num">${used}%</b>${Number(d.km) > 0 ? ` · <span class="num">${fmt(used / Number(d.km), 2)}%/km</span>` : ""}${dev != null ? ` · lệch dự báo <b class="num">${dev > 0 ? "+" : ""}${r0(dev)} điểm %</b> (${dev > 0 ? "tốn hơn dự báo" : dev < 0 ? "ít tốn hơn" : "đúng dự báo"})` : ""}`}</div>
    <div class="row"><button class="btn primary" type="submit" style="flex:1">Lưu chặng</button><button class="btn" type="button" data-act="draft-reset">Làm lại</button></div>
  </form>`;
}

/* ---------- Nhật ký ---------- */
function renderHistory() {
  const L = [...state.legs].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.order || 0) - (a.order || 0));
  let h = `<div class="card"><h2>Nhật ký tiêu hao</h2>
    <p class="small muted">Không bao giờ tự xoá dữ liệu cũ. Mỗi chặng ghi rõ km lấy từ đâu.</p>`;
  if (!L.length) h += `<p class="muted">Chưa có chặng nào. Ghi chặng đầu tiên ở tab “Ghi chặng”, hoặc nhập file sao lưu ở tab “Hồ sơ”.</p>`;
  L.forEach((l) => {
    const u = usedOf(l), km = Number(l.km) > 0 ? Number(l.km) : null, src = km ? l.kmSource || "none" : "none";
    const dev = u != null && l.predicted != null && l.predicted !== "" ? u - Number(l.predicted) : null;
    const nm = `${l.from?.name || l.from?.addr || ""}${l.to?.name || l.to?.addr ? " → " + (l.to.name || l.to.addr) : ""}`;
    h += `<div class="entry"><div class="top"><b>${esc(nm || "Chặng")}</b><span class="num"><b>${u != null ? u + "%" : "—"}</b></span></div>
      <div class="meta"><span class="num">${dmy(l.date)}</span>${l.pinStart != null && l.pinStart !== "" ? `<span class="num">${esc(l.pinStart)}→${esc(l.pinEnd)}%</span>` : ""}
        <span class="num">${km ? fmt(km) + " km" : "chưa có km"}</span><span class="chip k-${src}">${SOURCES[src] || src}</span>
        ${km && u != null ? `<span class="num">${fmt(u / km, 2)}%/km</span>` : ""}${km && !usable(l, state.settings.includeEstimates) ? "<span>(không tính vào mô hình)</span>" : ""}
        <span>${esc(TRAFFIC[l.traffic] || "")}${l.bridge ? " · cầu/dốc" : ""}${l.durationMin ? " · " + esc(l.durationMin) + "′" : ""}</span>
        ${dev != null ? `<span>lệch dự báo <b class="num">${dev > 0 ? "+" : ""}${r0(dev)}</b></span>` : ""}</div>
      ${l.via?.length ? `<p class="small muted">Qua: ${l.via.map((v) => esc(v.name || v.addr || "?")).join(", ")} (không biết pin ở đó)</p>` : ""}
      ${l.route ? `<p class="small muted">${esc(l.route)}</p>` : ""}${l.note ? `<p class="small muted">${esc(l.note)}</p>` : ""}
      ${ui.editId === l.id ? `<form id="editForm" data-id="${esc(l.id)}" class="row">
          <label>Km<input id="e-km" class="num" name="km" type="number" inputmode="decimal" step="0.1" min="0" value="${esc(l.km ?? "")}"></label>
          <label>Nguồn km<select id="e-src" name="kmSource">${["osm", "maps", "measured", "reported", "estimate"].map((k) => `<option value="${k}"${l.kmSource === k ? " selected" : ""}>${SOURCES[k]}</option>`).join("")}</select></label>
          <label>Phút<input id="e-dur" class="num" name="durationMin" type="number" inputmode="numeric" min="0" value="${esc(l.durationMin ?? "")}"></label>
          <label>Giao thông<select id="e-tr" name="traffic">${Object.entries(TRAFFIC).map(([k, v]) => `<option value="${k}"${l.traffic === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>
          <label class="check"><input id="e-br" name="bridge" type="checkbox"${l.bridge ? " checked" : ""}>Cầu/dốc</label>
          <div class="actions"><button class="btn sm primary" type="submit">Lưu</button><button class="btn sm" type="button" data-act="edit-cancel">Huỷ</button></div>
        </form>`
        : `<div class="actions">${ui.confirmDel === l.id
          ? `<button class="btn sm danger" data-act="del-yes" data-id="${esc(l.id)}" type="button">Xoá hẳn</button><button class="btn sm" data-act="del-no" type="button">Giữ lại</button>`
          : `<button class="btn sm" data-act="edit" data-id="${esc(l.id)}" type="button">Sửa</button><button class="btn sm danger" data-act="del" data-id="${esc(l.id)}" type="button">Xoá</button>`}</div>`}
    </div>`;
  });
  h += `</div>`;
  const c = calibration(state.legs);
  h += `<div class="card"><h2>Dự báo so với thực tế</h2>${c ? `<div class="stats">
      <div class="stat"><span class="l">Số chặng so sánh</span><span class="v">${c.n}</span></div>
      <div class="stat"><span class="l">Lệch trung bình</span><span class="v">${c.mean > 0 ? "+" : ""}${fmt(c.mean)}</span><span class="small muted">${c.mean > 1 ? "dự báo đang thấp hơn thực tế" : c.mean < -1 ? "dự báo đang cao hơn thực tế" : "khá sát"}</span></div>
      <div class="stat"><span class="l">Sai số TB</span><span class="v">${fmt(c.mae)}</span><span class="small muted">điểm %</span></div></div>`
    : `<p class="muted">Chưa có chặng nào có dự báo để so sánh. Đi theo lịch trình rồi bấm “Ghi pin thực tế chặng này”, số dự báo sẽ tự điền.</p>`}</div>`;
  $("#view-history").innerHTML = h;
}

/* ---------- Hồ sơ ---------- */
function renderSettings() {
  const M = buildModel(state.legs, state.settings);
  $("#view-settings").innerHTML = `<div class="card"><h2>Mô hình của xe bạn</h2><div class="stats">
      <div class="stat"><span class="l">Chặng dài (≥${SHORT_KM} km)</span><span class="v">${fmt(M.R, 2)}%/km</span><span class="small muted">${M.longN} chặng</span></div>
      <div class="stat"><span class="l">Chặng ngắn (&lt;${SHORT_KM} km)</span><span class="v">${M.short.rate != null ? fmt(M.short.rate, 2) + "%/km" : "—"}</span><span class="small muted">${M.short.n} chặng${M.short.rate == null ? " (cần ≥2)" : ""}</span></div>
      <div class="stat"><span class="l">Mức chung</span><span class="v">${fmt(M.RAll, 2)}%/km</span><span class="small muted">${fmt(M.sumU, 0)}% / ${fmt(M.sumK)} km</span></div>
      <div class="stat"><span class="l">Số lần đo có km</span><span class="v">${M.pts.length}</span><span class="small muted">${M.pts.length < 6 ? "còn ít, dự báo chưa chắc" : "đã khá đủ"}</span></div>
      <div class="stat"><span class="l">Thấp nhất</span><span class="v">${fmt(M.min, 2)}</span><span class="small muted">%/km · thuận lợi</span></div>
      <div class="stat"><span class="l">Cao nhất</span><span class="v">${fmt(M.max, 2)}</span><span class="small muted">%/km · bất lợi</span></div>
      <div class="stat"><span class="l">Tốc độ TB thực tế</span><span class="v">${M.speed ? fmt(M.speed) : "—"}</span><span class="small muted">${M.speed ? `km/h, từ ${M.speedN} chặng` : "chưa ghi thời gian chạy"}</span></div>
    </div>
    <p class="small muted">Xe 60V · 30Ah. 30 km/h là tốc độ tối đa thấy trên bản đồ, không phải tốc độ trung bình.</p>
    <div class="row">
      <label>Mức pin dự phòng (%)<input id="set-res" class="num" type="number" inputmode="numeric" min="0" max="60" value="${esc(state.settings.reserve)}"></label>
      <label class="check" style="flex:1 1 220px"><input id="set-est" type="checkbox"${state.settings.includeEstimates ? " checked" : ""}>Tính cả km ước tính chưa xác minh</label>
    </div></div>
  <div class="card"><h2>Cách dự báo</h2><ul class="clean small">
    <li>Chặng đã từng đi (cùng điểm đi, điểm đến): lấy số pin thực tế lần trước.</li>
    <li>Chặng mới: km × mức %/km từ các lần đo. Có cầu hoặc đường đông thì dùng mức của các chặng tương tự khi đã có ít nhất 2 chặng như vậy.</li>
    <li>Chặng ngắn dưới ${SHORT_KM} km (hay dừng đèn, tăng tốc lại) dùng mức riêng của các chặng ngắn đã đi.</li>
    <li>Thuận lợi dùng mức thấp nhất đã đo của chặng dài; bất lợi dùng mức cao nhất (+10% nếu có cầu/đông).</li>
    <li>Pin tính nối tiếp: pin đầu chặng sau = pin cuối chặng trước.</li>
  </ul></div>
  <div class="card"><h2>Sao lưu</h2>
    <p class="small muted">Dữ liệu chỉ nằm trên điện thoại này. Nên xuất file sao lưu sau mỗi tuần (lưu vào Tệp hoặc gửi qua Zalo cho chính mình).</p>
    <div class="row"><button class="btn primary" data-act="export" type="button" style="flex:1">Xuất file sao lưu</button>
      <label class="btn" style="flex:1;flex-direction:row;color:var(--ink);font-size:.92rem">Nhập file<input id="importFile" type="file" accept="application/json,.json" hidden></label></div>
    <p class="small muted">Nhập file sẽ thay toàn bộ dữ liệu hiện có trên máy bằng dữ liệu trong file.</p>
  </div>`;
}

function renderAll() { renderPlan(); renderLog(); renderHistory(); renderSettings(); }

/* ---------- hành động ---------- */
async function doSearch(i) {
  const s = state.plan.stops[i];
  const q = (s.addr || s.name || "").trim();
  if (!q) { toast("Nhập địa chỉ trước"); return; }
  ui.searching[i] = true; renderPlan();
  try { ui.results[i] = await searchPlace(q); }
  catch (e) { ui.results[i] = undefined; toast(navigator.onLine ? e.message : "Không có mạng. Bạn vẫn nhập km tay được."); }
  ui.searching[i] = false; renderPlan();
}
// Chỉ tự định vị khi có đúng một kết quả khớp chắc chắn; còn lại để người dùng chọn.
async function ensureLocated(i) {
  const s = state.plan.stops[i];
  if (s.lat != null) return true;
  const q = (s.addr || s.name || "").trim();
  if (!q) return false;
  const res = await searchPlace(q);
  const sure = res.list.filter((r) => !r.approx);
  if (sure.length === 1) {
    Object.assign(s, { lat: sure[0].lat, lon: sure[0].lon, label: sure[0].label, approx: false });
    ui.results[i] = undefined;
    return true;
  }
  ui.results[i] = res;
  return false;
}
async function doRoute(i) {
  ui.routing[i] = true; renderPlan();
  try {
    const okA = await ensureLocated(i), okB = await ensureLocated(i + 1);
    if (!okA || !okB) throw new Error("Chọn đúng địa điểm trong danh sách (hoặc chạm chọn trên bản đồ), rồi bấm “Tra km” lại.");
    const a = state.plan.stops[i], b = state.plan.stops[i + 1];
    const alts = await route(a, b);
    ui.routes[i] = alts;
    const pl = state.plan.legs[i];
    const approx = a.approx || b.approx;
    Object.assign(pl, { altIndex: 0, km: alts[0].km, mapsMin: alts[0].min, kmSource: approx ? "estimate" : "osm" });
    persist();
    toast(approx ? `Chặng ${i + 1}: ${fmt(alts[0].km)} km, nhưng có điểm chỉ gần đúng nên ghi là ước tính.` : `Chặng ${i + 1}: ${fmt(alts[0].km)} km`);
  } catch (e) { toast(navigator.onLine ? e.message : "Không có mạng. Bạn vẫn nhập km tay được."); }
  ui.routing[i] = false; renderPlan();
}
async function doExport() {
  const data = { app: "so-pin-xe-dien", version: 1, exportedAt: new Date().toISOString(), ...state };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const name = `so-pin-${today()}.json`;
  const file = new File([blob], name, { type: "application/json" });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: "Sao lưu Sổ Pin" }); return; }
  } catch (e) { if (e.name === "AbortError") return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
async function doImport(file) {
  try {
    const v = validateImport(JSON.parse(await file.text()));
    state.legs = v.legs;
    if (v.plan) state.plan = v.plan;
    if (v.settings) state.settings = { ...state.settings, ...v.settings };
    ui.routes = {}; ui.results = {};
    await save(state); renderAll();
    toast(`Đã nhập ${v.legs.length} chặng`);
  } catch (e) { toast(e.message || "Không đọc được file"); }
}

/* ---------- sự kiện ---------- */
function setView(v) {
  document.querySelectorAll(".tabbar button").forEach((b) => {
    if (b.dataset.view === v) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  ["plan", "log", "history", "settings"].forEach((k) => ($("#view-" + k).hidden = k !== v));
  if (v === "plan" && map) setTimeout(() => map.invalidateSize(), 50);
  window.scrollTo(0, 0);
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-view],[data-act]");
  if (!t) return;
  if (t.dataset.view) { setView(t.dataset.view); return; }
  const a = t.dataset.act, i = Number(t.dataset.i), p = state.plan;
  if (a !== "plan-clear") ui.confirmClear = false;
  switch (a) {
    case "search": doSearch(i); break;
    case "pick": {
      const r = ui.results[i].list[Number(t.dataset.k)];
      Object.assign(p.stops[i], { lat: r.lat, lon: r.lon, label: r.label, approx: !!r.approx });
      ui.results[i] = undefined; delete ui.routes[i - 1]; delete ui.routes[i];
      persist(); renderPlan(); break;
    }
    case "map-pick":
      ui.pickOnMap = ui.pickOnMap === i ? null : i;
      renderPlan();
      if (ui.pickOnMap === i) { $("#map").scrollIntoView({ behavior: "smooth", block: "center" }); toast(`Chạm vào bản đồ để đặt vị trí ${i === 0 ? "điểm xuất phát" : "điểm " + i}`); }
      break;
    case "route": doRoute(i); break;
    case "alt": {
      const k = Number(t.dataset.k), alt = ui.routes[i][k];
      const approx = p.stops[i].approx || p.stops[i + 1].approx;
      Object.assign(p.legs[i], { altIndex: k, km: alt.km, mapsMin: alt.min, kmSource: approx ? "estimate" : "osm" });
      persist(); renderPlan(); break;
    }
    case "stop-add": p.stops.push(blankStop()); p.legs.push(blankLeg()); persist(); renderPlan(); break;
    case "stop-del": p.stops.splice(i, 1); p.legs.splice(Math.min(i, p.legs.length - 1), 1); ui.routes = {}; ui.results = {}; persist(); renderPlan(); break;
    case "plan-clear":
      if (!ui.confirmClear) { ui.confirmClear = true; renderPlan(); break; }
      ui.confirmClear = false; state.plan = emptyPlan(); ui.routes = {}; ui.results = {}; persist(); renderPlan(); break;
    case "log-from-plan": {
      const F = forecastPlan(state.legs, p, state.settings), r = F.rows[i];
      const prev = i === 0 ? p.startPin : F.rows[i - 1].after ? r0(F.rows[i - 1].after.norm) : "";
      const pick = (s) => ({ name: s.name, addr: s.addr, lat: s.lat, lon: s.lon, label: s.label });
      ui.logDraft = { ...newDraft(), date: p.date || today(), order: i + 1, from: pick(r.a), to: pick(r.b), route: r.pl.route,
        km: r.pl.km, kmSource: r.pl.kmSource, traffic: r.pl.traffic, bridge: r.pl.bridge, pinStart: prev ?? "", predicted: r.f.ok ? r0(r.f.norm) : "" };
      ui.logMode = "single"; renderLog(); setView("log"); break;
    }
    case "draft-reset": ui.logDraft = newDraft(); renderLog(); break;
    case "mode-journey": ui.logMode = "journey"; renderLog(); break;
    case "mode-single": ui.logMode = "single"; renderLog(); break;
    case "j-add": ui.journey.stops.push(blankJStop()); renderLog(); break;
    case "j-del": ui.journey.stops.splice(i, 1); renderLog(); break;
    case "j-route": doJourneyRoute(i); break;
    case "j-reset": ui.journey = newJourney(); renderLog(); break;
    case "j-from-plan": {
      // Lấy các điểm của lịch trình hiện tại; pin để trống cho bạn điền.
      ui.journey = { ...newJourney(), date: p.date || today(), stops: p.stops.map((s, k) => {
        const pl = k > 0 ? p.legs[k - 1] : null;
        return { ...blankJStop(), name: s.name, addr: s.addr, lat: s.lat, lon: s.lon, label: s.label,
          pin: k === 0 && p.startPin !== "" ? p.startPin : "", leave: s.time || "",
          ...(pl ? { km: pl.km, kmSource: pl.kmSource, traffic: pl.traffic, bridge: pl.bridge } : {}) };
      }) };
      renderLog(); toast("Đã lấy điểm từ lịch trình. Điền pin khi tới từng điểm."); break;
    }
    case "j-save": {
      let legs;
      try { legs = journeyToLegs(ui.journey); } catch (err) { toast(err.message); break; }
      const stamp = Date.now().toString(36);
      legs.forEach((l, k) => state.legs.push({ ...l, id: `leg-${stamp}-${k}`, createdAt: new Date().toISOString() }));
      ui.journey = newJourney();
      persist(); renderAll(); setView("history"); toast(`Đã lưu ${legs.length} chặng`);
      break;
    }
    case "edit": ui.editId = t.dataset.id; ui.confirmDel = null; renderHistory(); break;
    case "edit-cancel": ui.editId = null; renderHistory(); break;
    case "del": ui.confirmDel = t.dataset.id; renderHistory(); break;
    case "del-no": ui.confirmDel = null; renderHistory(); break;
    case "del-yes":
      state.legs = state.legs.filter((l) => l.id !== t.dataset.id); ui.confirmDel = null;
      persist(); renderAll(); toast("Đã xoá chặng"); break;
    case "export": doExport(); break;
  }
});

document.addEventListener("change", (e) => {
  const t = e.target, p = state.plan;
  if (t.id === "p-date") { p.date = t.value; persist(); return; }
  if (t.id === "p-start") { p.startPin = t.value === "" ? "" : Math.max(0, Math.min(100, Number(t.value))); persist(); renderPlan(); return; }
  if (t.dataset.stop != null) {
    const i = Number(t.dataset.stop), s = p.stops[i];
    s[t.dataset.f] = t.value;
    if (t.dataset.f === "addr") { Object.assign(s, { lat: null, lon: null, label: "" }); delete ui.routes[i - 1]; delete ui.routes[i]; }
    persist(); renderPlan(); return;
  }
  if (t.dataset.leg != null) { p.legs[Number(t.dataset.leg)][t.dataset.f] = t.type === "checkbox" ? t.checked : t.value; persist(); renderPlan(); return; }
  if (t.dataset.js != null) {
    const s = ui.journey.stops[Number(t.dataset.js)], f = t.dataset.f;
    s[f] = t.type === "checkbox" ? t.checked : t.value;
    if (f === "addr" || (f === "name" && !s.addr)) Object.assign(s, { lat: null, lon: null, label: "" });
    renderLog(); return;
  }
  if (t.dataset.j) { ui.journey[t.dataset.j] = t.value; return; }
  if (t.form?.id === "logForm") {
    const d = ui.logDraft, v = t.type === "checkbox" ? t.checked : t.value;
    if (t.name.includes(".")) { const [o, k] = t.name.split("."); d[o][k] = v; if (k === "addr") Object.assign(d[o], { lat: null, lon: null }); }
    else d[t.name] = v;
    renderLog(); return;
  }
  if (t.id === "set-res") { state.settings.reserve = Math.max(0, Math.min(60, Number(t.value) || 0)); persist(); renderAll(); return; }
  if (t.id === "set-est") { state.settings.includeEstimates = t.checked; persist(); renderAll(); return; }
  if (t.id === "importFile" && t.files[0]) { doImport(t.files[0]); t.value = ""; }
});

document.addEventListener("keydown", (e) => {
  const t = e.target;
  if (e.key === "Enter" && t.dataset?.stop != null && t.dataset.f === "addr") {
    e.preventDefault(); t.blur(); doSearch(Number(t.dataset.stop));
  }
});

document.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === "logForm") {
    const d = ui.logDraft;
    if (d.pinStart === "" || d.pinEnd === "") { toast("Cần nhập pin lúc đi và lúc đến"); return; }
    const n = (v) => (v === "" || v == null ? null : Number(v));
    const rec = { id: "leg-" + Date.now().toString(36), date: d.date, order: Number(d.order) || 1,
      from: { ...d.from, name: d.from.name.trim(), addr: d.from.addr.trim() }, to: { ...d.to, name: d.to.name.trim(), addr: d.to.addr.trim() },
      route: d.route.trim(), km: n(d.km), kmSource: d.km === "" ? "none" : d.kmSource, pinStart: Number(d.pinStart), pinEnd: Number(d.pinEnd),
      traffic: d.traffic, bridge: !!d.bridge, durationMin: n(d.durationMin), predicted: n(d.predicted), note: d.note.trim(), createdAt: new Date().toISOString() };
    state.legs.push(rec);
    ui.logDraft = { ...newDraft(), date: d.date, order: rec.order + 1, from: { ...rec.to }, pinStart: rec.pinEnd };
    persist(); renderAll(); setView("history"); toast("Đã lưu chặng");
  } else if (f.id === "editForm") {
    const fd = new FormData(f), l = state.legs.find((x) => x.id === f.dataset.id);
    if (!l) return;
    l.km = fd.get("km") === "" ? null : Number(fd.get("km"));
    l.kmSource = l.km == null ? "none" : fd.get("kmSource");
    l.durationMin = fd.get("durationMin") === "" ? null : Number(fd.get("durationMin"));
    l.traffic = fd.get("traffic"); l.bridge = !!fd.get("bridge");
    ui.editId = null; persist(); renderAll(); toast("Đã cập nhật");
  }
});

/* ---------- khởi động ---------- */
(async function boot() {
  const saved = await load();
  if (saved) state = { ...state, ...saved, settings: { ...state.settings, ...(saved.settings || {}) } };
  initMap();
  renderAll();
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  let hide = false; try { hide = localStorage.getItem("hideInstall") === "1"; } catch {}
  if (ios && !standalone && !hide) $("#installHint").hidden = false;
  $("#installClose").addEventListener("click", () => { $("#installHint").hidden = true; try { localStorage.setItem("hideInstall", "1"); } catch {} });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
