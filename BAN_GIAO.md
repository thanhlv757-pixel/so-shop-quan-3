# Bàn giao Sổ Shop · Quận 3

## Trạng thái bàn giao

Gói này là bản sao mã nguồn mới nhất đang có trong checkout của ứng dụng, kèm đặc tả và hướng dẫn tiếp tục. Không có token, tài khoản được cấp sẵn, dữ liệu D1 thực tế hay ảnh R2 thực tế. Việc bàn giao gói không chuyển quyền sở hữu trên Sites hoặc GitHub. Website đang hoạt động được giữ nguyên.

Dự án hiện tại: `appgprj_6adaf817e6b48191b0f192dee3439e6c`  
URL: https://so-shop-q3-thanh.thanhlv757.chatgpt.site  
Múi giờ nghiệp vụ: Asia/Ho_Chi_Minh. Tiền tệ: VNĐ, số nguyên. Ngày giao diện dùng định dạng Việt Nam, lưu chuỗi ISO `YYYY-MM-DD`.

## Cách chọn hướng tiếp tục

**Có Sites ở Claude và truy cập được cùng dự án:** dùng công cụ của chính phiên Claude để kiểm tra project ID ở trên, đọc quyền truy cập và lấy mã nguồn qua workflow hợp lệ. Giữ cùng project ID, quyền riêng tư và tài nguyên đang lưu. Không tạo web mới hoặc yêu cầu chuyển hosting nếu có thể làm trực tiếp.

**Chưa truy cập được Sites:** mở thư mục mã nguồn bằng Claude Code hoặc đưa vào GitHub riêng. Tiếp tục phát triển được từ mã nguồn, nhưng việc triển khai lên URL đang chạy vẫn cần quyền Sites. Nếu muốn bỏ Sites, thực hiện kế hoạch trong `docs/MIGRATION.md` trước khi đổi URL.

## Các chức năng đã triển khai

| Phần | Hành vi |
| --- | --- |
| Tổng quan | Chọn tháng, tổng chi/quỹ/vợt/cọc, đồ thị vợt, tiền công dự tính |
| Quỹ chi | Nhiều khoản/ngày, quỹ đầu tháng, ba mã riêng, phân loại, mục Chi nội bộ, bộ lọc/tìm kiếm |
| Đếm hóa đơn | Chỉ mỗi dòng Chi theo đơn hàng tính 1; mọi loại đều cộng tổng tiền |
| Ảnh chứng từ | Chọn tệp/dán từ clipboard, xem trước, lưu cùng khoản, xem lớn/tải ảnh |
| Đan vợt | Theo ngày và từng nhân viên, số ngày tháng thực tế, sửa thay thế tổng trong ngày |
| Tiền công | KPI 450 toàn shop; mức 5.000/10.000 áp dụng toàn bộ tháng, tổng từng người |
| Cọc sản phẩm | Nhiều loại sản phẩm, size/màu, kênh và tài khoản liên hệ, trạng thái giao/hoàn cọc |
| Excel | Tổng hợp 4 trang tính hoặc xuất riêng; công thức và cache; ảnh ở cột cuối sổ chi |
| Sao lưu | JSON toàn bộ tháng và tham chiếu ảnh; khôi phục thay dữ liệu với xác nhận |
| Lưu trực tuyến | D1 theo tài khoản, R2 riêng ảnh, chống ghi đè phiên bản cũ |

Quy tắc chi tiết, đặc biệt cách tính tiền công và hóa đơn, nằm trong `CLAUDE.md`. Không coi các số liệu trong ba Excel mẫu trước đây là dữ liệu cần khôi phục.

## Điểm vào mã nguồn

| Tệp | Vai trò |
| --- | --- |
| `app/page.tsx` | Toàn bộ UI hiện tại, form, tab chi nội bộ, dán ảnh, xuất báo cáo |
| `app/globals.css` | Giao diện đáp ứng màn hình nhỏ/lớn |
| `app/model.ts` | Kiểu dữ liệu và phép tính thống kê/KPI/tiền công/phân loại |
| `app/validation.ts` | Zod, nâng cấp trường thiếu của bản ghi cũ |
| `app/excel.ts` | OOXML/ZIP, công thức tổng/COUNTIF/SUMIF và ảnh nhúng |
| `app/images.ts` | Tối ưu ảnh và gọi endpoint tải lên |
| `app/api/state/route.ts` | GET/PUT D1; kiểm tra danh tính và so khớp revision |
| `app/api/evidence/route.ts` | Upload có giới hạn và kiểm tra chữ ký ảnh |
| `app/api/evidence/[id]/route.ts` | Đọc ảnh trong namespace riêng của chủ tài khoản |
| `db/schema.ts`, `drizzle/` | Bảng shop_state và migration schema |
| `vite.config.ts`, `worker/index.ts` | Chạy/build Worker và tích hợp Sites |
| `.openai/hosting.json` | Danh tính dự án cùng binding DB/BUCKET; không phải mật khẩu |
| `scripts/test-shop.mjs` | Test nghiệp vụ, API với SQLite trong bộ nhớ và file xuất |
| `scripts/test-evidence.mjs` | Test upload/đọc ảnh riêng tư và ảnh trong XLSX |

## Giới hạn đã biết

- Chưa kiểm thử trực quan bằng trình duyệt vì công cụ xem thử trước đây bị chặn. Cần test thật trên desktop/mobile, đặc biệt dán ảnh, upload, tải Excel và đóng/mở form.
- Chưa có nhiều tài khoản nhân viên dùng chung một sổ, đổi/xóa tên nhân viên, tính lương cố định/phụ cấp/khấu trừ, chốt tháng, nhập Excel tùy ý hay đồng bộ POS.
- Cọc giao/hoàn cọc là ghi nhận thủ công, không chuyển tiền.
- Gỡ ảnh khỏi khoản chi chỉ bỏ tham chiếu. Chưa có giao diện dọn ảnh mồ côi.
- Mỗi tài khoản lưu cả sổ vào một JSON có revision; quy mô lớn hơn cần đánh giá tách bảng.
- Mã nguồn đã được đưa vào kho GitHub riêng của chủ dự án: https://github.com/thanhlv757-pixel/so-shop-quan-3. Chưa cấp quyền cho phiên Claude, chưa chuyển quyền Sites hoặc di chuyển dữ liệu/hosting.

## Điều kiện nghiệm thu sau khi tiếp quản

Chạy checks, mở thử form và xác minh ảnh/clipboard; xác nhận 449→450 và sửa giảm về 449; kiểm tra chi nội bộ có mã chứng từ vẫn không tăng số hóa đơn; kiểm tra tháng mới không làm mất cọc cũ; mở Excel có công thức đúng và ảnh đúng dòng. Chỉ báo đã triển khai hoặc chuyển dữ liệu sau khi có kết quả xác minh thực tế.
