# Sổ Shop — web độc lập

Bản này chạy bằng Node.js 24, React và SQLite. Không gọi Sites, D1, R2 hoặc đăng nhập ChatGPT. Một tài khoản quản lý dùng chung một sổ shop; chưa có phân quyền từng nhân viên. Toàn bộ quỹ chi, phân loại chi nội bộ, KPI đan vợt, khách cọc, dán ảnh và xuất Excel được giữ từ bản hiện tại.

## Chạy trên máy

```sh
cd standalone
npm ci
npm run build
npm run password
```

Chép dòng `SHOP_PASSWORD_HASH=...` vừa tạo vào `.env` trên máy riêng (không đưa lên GitHub). Thêm:

```dotenv
SHOP_USERNAME=thanh
DATA_DIR=./data
PORT=3000
```

Chạy `node --env-file=.env server.mjs`, mở http://localhost:3000. Mật khẩu không có mặc định. Đổi mật khẩu bằng cách tạo hash mới, xóa phiên cũ trong bảng sessions khi cần thu hồi đăng nhập.

## Đưa lên hosting

Nguồn: kho `thanhlv757-pixel/so-shop-quan-3`, nhánh `main`, **root directory `standalone`**. Dùng Dockerfile trong thư mục này. Có thể dùng máy chủ Docker riêng hoặc dịch vụ hỗ trợ Docker và persistent disk.

Thiết lập trước khi chạy production:

| Biến | Giá trị |
| --- | --- |
| NODE_ENV | production |
| APP_ORIGIN | URL HTTPS chính thức, không có dấu `/` cuối |
| SHOP_USERNAME | tài khoản quản lý |
| SHOP_PASSWORD_HASH | hash tạo bằng `npm run password` |
| DATA_DIR | /data |
| PORT | 3000 hoặc cổng hosting cấp |

**Bắt buộc gắn persistent volume vào `/data`**, cho user UID 1000 quyền ghi. Chạy đúng một replica; không dùng filesystem tạm, không autoscale nhiều replica. SQLite và ảnh nằm cùng volume. Reverse proxy phải phục vụ HTTPS; cookie production chỉ gửi qua HTTPS. Health check `/health` chỉ xác nhận tiến trình đang chạy.

Ví dụ Docker trên máy chủ đã có HTTPS reverse proxy:

```sh
docker build -t so-shop .
docker volume create so-shop-data
docker run --rm -v so-shop-data:/data --user root node:24-bookworm-slim chown -R 1000:1000 /data
docker run -d --name so-shop --restart unless-stopped --env-file .env.production -p 127.0.0.1:3000:3000 -v so-shop-data:/data so-shop
```

Tạo `.env.production` với các biến trên. Không đưa file này vào Git. Hosting có thể tính phí; chưa tạo dịch vụ hay mua gói hosting trong bước chuẩn bị mã nguồn.

## Dữ liệu và sao lưu

- Web mới bắt đầu bằng sổ trống. Chưa chuyển giao dịch hoặc ảnh từ Sites.
- JSON trong giao diện không chứa tệp ảnh. JSON không có ảnh có thể nhập vào sổ mới. Nếu có mã ảnh từ Sites, máy chủ mới sẽ từ chối lưu cho đến khi có ảnh tương ứng; không tự bỏ chứng từ.
- Chuyển dữ liệu có ảnh cần xuất ảnh thực và nhập vào máy chủ mới, ánh xạ lại mã ảnh trước khi mở sử dụng chính thức. Giữ web Sites hoạt động cho đến khi đối chiếu xong.
- Sao lưu đầy đủ: dừng ứng dụng rồi sao chép **toàn bộ volume `/data`** (SQLite, WAL/SHM nếu có và thư mục photos). Khôi phục toàn bộ volume trong lúc ứng dụng dừng. Excel dùng để báo cáo; không thay thế bản sao lưu máy chủ.
- Dữ liệu được kiểm tra schema ở server. Lưu theo revision để tránh tab/thiết bị cũ ghi đè. Ảnh và tài nguyên giao diện yêu cầu phiên đăng nhập. Giới hạn thử đăng nhập có lưu trong SQLite; sau proxy có thể dùng chung hạn mức theo địa chỉ proxy.

## Kiểm tra

`npm run build && npm test`. Kiểm tra tích hợp đăng nhập, chặn truy cập chưa đăng nhập, chặn nguồn khác, lưu và xung đột revision, dữ liệu sai, byte ảnh, ảnh giả và đăng xuất. Chưa xác minh giao diện bằng trình duyệt ở môi trường này.

## Tiếp tục bằng Claude

Làm trong `standalone/`. Các file tại gốc kho là bản Sites cũ; không sửa hay deploy Sites khi đang phát triển bản độc lập. Chưa có URL production mới. Cần kết nối hosting, gắn volume, thiết lập bí mật và xác nhận triển khai thành công trước khi tuyên bố web đã lên mạng.
