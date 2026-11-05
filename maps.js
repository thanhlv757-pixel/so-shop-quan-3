// Tra địa chỉ (Nominatim) và quãng đường (OSRM) từ OpenStreetMap. Miễn phí, không cần khóa.

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OSRM = "https://router.project-osrm.org/route/v1/driving/";
// Khung ưu tiên quanh TP. Hồ Chí Minh (lon1,lat1,lon2,lat2)
const HCM_VIEWBOX = "106.35,11.2,107.05,10.35";

let lastNominatim = 0;
async function politeWait() {
  // Nominatim cho phép tối đa 1 yêu cầu mỗi giây.
  const wait = lastNominatim + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
}

async function getJSON(url, signal) {
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(res.status === 429 ? "Dịch vụ bản đồ đang bận, thử lại sau ít phút." : `Dịch vụ bản đồ trả lỗi ${res.status}.`);
  return res.json();
}

/**
 * Các cách gõ lần lượt thử khi tìm. Dữ liệu OSM dùng tên phường mới sau sáp nhập
 * và hầu như không có số nhà, nên bỏ dần "Quận/Phường" rồi bỏ số nhà.
 * Trả về [{q, approx}] — approx = chỉ còn tên đường, vị trí có thể lệch xa.
 */
export function queryVariants(q) {
  const text = String(q || "").trim().replace(/\s+/g, " ");
  if (!text) return [];
  const noArea = text
    .replace(/,?\s*\b(quận|q\.|huyện|h\.|phường|p\.|tp\.?|thành phố)\s*[^,]*/gi, "")
    .replace(/,?\s*(hồ chí minh|hcm|sài gòn|saigon)\b/gi, "")
    .replace(/^[,\s]+|[,\s]+$/g, "");
  const mainNumber = noArea.replace(/^(\d+)\/[\w\/-]+/, "$1"); // 139/3 → 139 (hẻm thường không có trên OSM)
  const noNumber = noArea.replace(/^(số\s*)?[\d][\w\/-]*\s+/i, "").trim();
  const out = [];
  const add = (q2, approx) => { if (q2 && !out.some((o) => o.q === q2)) out.push({ q: q2, approx }); };
  add(text, false);
  add(noArea, false);
  add(mainNumber, false);
  if (/^(số\s*)?\d/i.test(noArea)) add(noNumber, true);
  return out;
}

/** Số nhà ở đầu câu tìm (vd "139/3 Phan..." → "139"), hoặc null. */
export function houseNumber(q) {
  const m = String(q || "").trim().match(/^(?:số\s*)?(\d+)/i);
  return m ? m[1] : null;
}

/** Kết quả có khớp số nhà đã gõ không (OSM hay bỏ qua số nhà và trả về cả con đường). */
export function matchesHouseNumber(label, num) {
  if (!num) return true;
  return new RegExp(`(^|[^\\d])${num}([^\\d]|$)`).test(label);
}

/** Tìm địa điểm. Trả về {list: [{label, lat, lon, approx}], approx}. */
export async function searchPlace(q, signal) {
  const num = houseNumber(q);
  for (const v of queryVariants(q)) {
    await politeWait();
    const p = new URLSearchParams({ q: v.q, format: "jsonv2", countrycodes: "vn", "accept-language": "vi", limit: "5", viewbox: HCM_VIEWBOX, bounded: "1" });
    const rows = await getJSON(`${NOMINATIM}?${p}`, signal);
    if (!rows.length) continue;
    const list = rows.map((r) => ({
      label: r.display_name, lat: Number(r.lat), lon: Number(r.lon),
      approx: v.approx || !matchesHouseNumber(r.display_name, num),
    }));
    list.sort((a, b) => a.approx - b.approx);
    return { list, approx: list.every((x) => x.approx) };
  }
  return { list: [], approx: false };
}

/** Tính tuyến giữa hai điểm có tọa độ. Trả về các tuyến {km, min, geometry}. */
export async function route(a, b, signal) {
  const coords = `${a.lon},${a.lat};${b.lon},${b.lat}`;
  const data = await getJSON(`${OSRM}${coords}?overview=full&geometries=geojson&alternatives=true`, signal);
  if (data.code !== "Ok" || !data.routes?.length) throw new Error("Không tìm được đường đi giữa hai điểm này.");
  return data.routes.map((r) => ({
    km: Math.round(r.distance / 100) / 10,
    min: Math.round(r.duration / 60),
    geometry: r.geometry,
  }));
}

/** Link mở Google Maps (không cần khóa). */
export function googleMapsLink(a, b) {
  const pt = (s) => (s.lat != null ? `${s.lat},${s.lon}` : (s.addr || s.name || "").trim());
  if (!pt(a) || !pt(b)) return null;
  return `https://www.google.com/maps/dir/?api=1&travelmode=two-wheeler&origin=${encodeURIComponent(pt(a))}&destination=${encodeURIComponent(pt(b))}`;
}
