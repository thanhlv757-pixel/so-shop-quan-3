// Cho app mở được khi không có mạng. Đổi VERSION mỗi lần cập nhật file.
const VERSION = "so-pin-v2";
const SHELL = [
  "./", "index.html", "styles.css", "app.js", "model.js", "maps.js", "store.js", "manifest.webmanifest",
  "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
  "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // bản đồ, tra km: luôn lấy từ mạng
  // Mạng trước để luôn có bản mới; mất mạng thì dùng bản đã lưu.
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
