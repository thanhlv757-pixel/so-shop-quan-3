# Sổ Pin Xe Điện

Ứng dụng web cài lên điện thoại (PWA) để theo dõi và dự báo pin xe điện theo từng chặng.

- Dữ liệu chỉ lưu trên máy người dùng (IndexedDB). Repo này không chứa dữ liệu cá nhân.
- Bản đồ: OpenStreetMap (Nominatim tìm địa chỉ, OSRM tính quãng đường, Leaflet 1.9.4 hiển thị). Không cần API key.
- Không có bước build. Kiểm thử logic: `node --test tests/*.test.js`.
- Mỗi lần sửa file, tăng `VERSION` trong `sw.js` để điện thoại nhận bản mới.
