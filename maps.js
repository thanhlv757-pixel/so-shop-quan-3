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

/** Tìm địa chỉ. Trả về tối đa 5 kết quả {label, lat, lon}. */
export async function searchPlace(q, signal) {
  const text = String(q || "").trim();
  if (!text) return [];
  await politeWait();
  const p = new URLSearchParams({ q: text, format: "jsonv2", countrycodes: "vn", "accept-language": "vi", limit: "5", viewbox: HCM_VIEWBOX, addressdetails: "0" });
  const rows = await getJSON(`${NOMINATIM}?${p}`, signal);
  return rows.map((r) => ({ label: r.display_name, lat: Number(r.lat), lon: Number(r.lon) }));
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
