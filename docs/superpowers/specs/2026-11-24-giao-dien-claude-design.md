# Giao diện mới Sổ Shop (phong cách app Claude) và cách nhập số vợt mới

Ngày: 24/11/2026 · Áp dụng cho: `index.html` (web chính https://so-shop-quan-3.netlify.app)

## Lý do

- Người dùng thấy chữ quá nhỏ (chữ thường 14px, chữ phụ 12–13px, có chỗ 11px).
- Người dùng chọn phong cách app Claude làm chuẩn, màu nhấn cam đất.
- Số vợt được nhập dồn trên điện thoại gần cuối tháng, đếm thủ công từ ảnh trong nhóm Zalo. Bảng 31 dòng × 3 người hiện tại khó dùng trên điện thoại.

## Mục tiêu

1. Đổi toàn bộ giao diện sang phong cách đã duyệt trong bản xem thử: nền ngà ấm, tiêu đề chữ có chân, chữ nội dung 16px, chữ phụ ≥ 14px, thẻ bo 16px viền mảnh, một màu nhấn cam đất, có bản tối tự theo máy.
2. Thay bảng đan vợt bằng hai cách nhập đã thử: **Theo ngày** (từng ngày, 3 người, nút − / +, Enter sang người tiếp rồi ngày sau, lịch tháng tô ngày đã có số) và **Theo từng người** (chọn một người, cả tháng một danh sách, Enter xuống ngày sau).
3. Số nhập ghi thẳng vào Supabase như hiện nay (bảng `strings`), không còn lưu trên điện thoại.

## Không làm

- Không đổi dữ liệu, schema, phân quyền Supabase, Edge Function.
- Không đổi quy tắc nghiệp vụ (KPI 450 toàn shop, 5.000/10.000 đ áp cho cả tháng, quỹ chi, tiền cọc), không đổi file Excel.
- Không thêm thư viện, không chuyển sang framework, không có bước build.
- Không kết nối Zalo, không đếm ảnh tự động.

## Thất bại dù chạy được

- Mất hoặc ghi sai số vợt (ví dụ bấm nhanh + nhiều lần mà chỉ lưu được lần cuối sai ngày/người).
- Chữ hoặc nút nhỏ hơn hiện tại ở bất kỳ chỗ nào; tràn ngang ở 375px; chữ khó đọc ở bản tối.

## Cách làm đã cân nhắc

| Cách | Đánh đổi | Chọn |
|---|---|---|
| A. Sửa CSS tại chỗ (đổi bộ màu, chữ, bo góc trong `:root` và các lớp sẵn có) + viết lại riêng trang Đan vợt | Ít đổi mã chạy, giữ nguyên logic đã test; trang khác chỉ đổi vẻ ngoài, bố cục gần như cũ | **Chọn** |
| B. Viết lại cả app (React/khung mới) | Đẹp đồng bộ hơn nhưng rủi ro lớn, phải test lại mọi thứ, trái với "không build" | Loại |
| C. Chỉ tăng cỡ chữ + làm trang Đan vợt | Ít việc nhất nhưng không phải "giao diện mới" như người dùng yêu cầu | Loại |

## Thiết kế

- **Màu (sáng / tối):** nền `#f5f4ef` / `#262624`, thẻ `#fffefb` / `#30302d`, chữ `#1f1e1b` / `#ecebe6`, chữ phụ `#6b6a63` / `#a6a49b`, viền `#e3e0d6` / `#3b3a36`, nhấn cam đất `#c96442` / `#e08b6b`. Màu đỏ (lỗi, âm quỹ), vàng (cảnh báo), xanh (đạt, ngày đã có số) giữ vai trò ngữ nghĩa, tách khỏi màu nhấn.
- **Chữ:** Inter (nội dung) và Source Serif 4 (tiêu đề) từ Google Fonts, có font dự phòng của máy. Thang chữ: 14 / 16 / 19 / 22–26 / 30–38px. Không chữ nào dưới 13px.
- **Bố cục:** giữ menu trái (máy tính) và menu ☰ (điện thoại), giữ bảng → thẻ ở 375px. Thẻ bo 16px, viền 1px, bỏ bóng. Ô nhập và nút tối thiểu 44px trên điện thoại.
- **Đan vợt:** dùng lại hàm lưu sẵn có (upsert theo ngày vào `strings`). Bấm + / − liên tiếp được gộp, lưu sau khoảng 0,6 giây không bấm, để không gửi quá nhiều lần và không ghi đè sai. Báo "Đã lưu …" hoặc lỗi ngay trên trang; lỗi thì trả số về giá trị trước đó. Ngày tương lai vẫn khóa. Tiền công tạm tính giữ trên trang.
- **Tệp hướng dẫn:** cập nhật `.ux-profile.md` sang chuẩn mới (phong cách Claude, cam đất, có bản tối).

## Kiểm tra

- Test Playwright mới, dữ liệu giả nằm trong test, giả lập Supabase: nhập theo ngày và theo người, bấm + nhiều lần, kiểm tra nội dung gửi lên Supabase đúng ngày/người/số; lỗi mạng thì số quay về.
- Chụp màn hình 375px và 1280px, sáng và tối, mọi trang: không lỗi JS, không tràn ngang.
- Chạy lại `npm run excel` để chắc Excel không đổi.

## Đưa lên web

Netlify tự cập nhật khi nhánh `main` thay đổi. Sau khi người dùng xem bản thử của nhánh và đồng ý, mới gộp vào `main`.

## Để lại cho người làm

- Cách sắp xếp chi tiết từng trang (Tổng quan, Quỹ chi, Khách cọc, Báo cáo, Cài đặt) trong khuôn màu/chữ trên.
