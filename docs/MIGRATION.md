# Quyền truy cập, GitHub và chuyển nơi triển khai

## A. Tiếp tục cùng Sites nếu Claude có công cụ phù hợp

1. Claude phải kiểm tra các công cụ thật đang được kết nối, dùng đúng tài khoản của chủ dự án và gọi đọc dự án `appgprj_6adaf817e6b48191b0f192dee3439e6c`.
2. Nếu được trả về quyền editor/owner và có workflow nguồn/triển khai, dùng workflow của Sites trong môi trường đó để lấy bản mới nhất. Bản ZIP chỉ là snapshot, có thể đã cũ nếu web được sửa sau ngày bàn giao.
3. Giữ `.openai/hosting.json`, project ID, audience private, DB và BUCKET; lấy thông tin truy cập tạm thời từ công cụ hiện tại, không dùng token cũ hay yêu cầu chủ tài khoản gửi mật khẩu.
4. Chỉnh, kiểm tra, lưu/push nguồn và triển khai theo chính workflow của công cụ. Xác nhận deployment succeeded cùng URL trước khi báo hoàn tất.
5. Nếu Claude chỉ nhìn thấy một biểu tượng Sites nhưng không có công cụ đọc/ghi dự án, chưa thể coi là có quyền. Báo thiếu khả năng cụ thể thay vì hứa đã tiếp quản.

Không tự thêm một tài khoản tên “Claude” vào quyền chia sẻ; trợ lý không phải một danh tính người dùng đã được xác minh. Quyền nằm trong tài khoản/kết nối của chủ dự án.

## B. Kho GitHub riêng

Kho GitHub là nơi giữ mã nguồn, không tự làm mã đó xuất hiện trên URL Sites. Kho đã tạo: https://github.com/thanhlv757-pixel/so-shop-quan-3 — PRIVATE, thuộc tài khoản thanhlv757-pixel đã được xác minh. Mã nguồn và tài liệu trong nhánh main là bản bàn giao; không đồng nghĩa quyền viết/triển khai đã được cấp cho một phiên Claude. Chủ dự án cần mở kho bằng Claude Code hoặc kết nối chính tài khoản GitHub của mình trong môi trường Claude.

Khi có kết nối hợp lệ: xác minh danh tính, kiểm tra kho đích tồn tại hay chưa, tạo hoặc dùng đúng kho riêng được chủ dự án chỉ định; đẩy snapshot hiện tại thành commit ban đầu. Không đưa `.git` cũ, seed.json đã xóa ở lịch sử, .env, .wrangler, runtime, dữ liệu khách, ảnh chứng từ hay token vào repository. Không tự đổi visibility thành public.

Nếu làm thủ công: tạo một kho PRIVATE trên GitHub của bạn rồi mở terminal trong thư mục snapshot:

```sh
git init
git add .
git commit -m "Initial handoff of So Shop Quan 3"
git branch -M main
```

Sau đó thêm remote đúng URL GitHub vừa tạo và push theo hướng dẫn của GitHub bằng đăng nhập của bạn. Dùng Claude Code trên checkout này hoặc kết nối kho đó vào công cụ lập trình của Claude nếu môi trường Claude hỗ trợ. Kết nối chỉ để đọc kho không bảo đảm có quyền push.

## C. Chuyển hẳn khỏi Sites

Đây là bước triển khai/migration riêng; chưa thực hiện trong gói bàn giao.

- Chuẩn bị tài khoản hosting thuộc người dùng, D1/R2 mới hoặc dịch vụ thay thế tương đương. Không đoán database/bucket ID từ các placeholder local trong Vite config.
- Thay đường đăng nhập Sites bằng cơ chế xác thực server đã kiểm chứng phù hợp với hạ tầng mới. Các header oai-authenticated-user-* chỉ đáng tin cậy sau lớp dispatch Sites. Trên một máy chủ công khai thông thường, không được chấp nhận header do trình duyệt tự gửi để truy cập sổ/ảnh.
- Giữ kiểm tra owner cho mọi API và ảnh, Cache-Control private/no-store, giới hạn upload/định dạng và revision chống ghi đè.
- Xuất bản JSON mới nhất qua mục Báo cáo trên web hiện tại. JSON chứa tham chiếu ảnh, không chứa bytes ảnh. Xuất Excel kèm ảnh để giữ chứng từ ngoại tuyến, nhưng ảnh Excel không phải một bản R2 có thể khôi phục nguyên trạng.
- Muốn khôi phục đầy đủ ảnh sang bucket mới cần xuất bytes ảnh và lập ánh xạ metadata. R2 hiện đặt key theo SHA-256 của ID người dùng Sites và UUID ảnh; ID đăng nhập ở hệ thống mới có thể khác. Sao chép bucket hoặc JSON đơn thuần có thể làm ảnh không truy cập được; cần ánh xạ chủ sở hữu một cách có kiểm soát.
- Không sửa owner trong dữ liệu production cũ chỉ để làm môi trường mới đọc được. Tạo mapping tại đích, kiểm tra sổ/ảnh ở đó trước, giữ bản gốc hoạt động.
- Kiểm thử máy chủ, đăng nhập, dữ liệu nhiều tháng, tổng tiền, số hóa đơn, tiền công 449/450, cọc cũ, ảnh và xuất Excel. Chỉ chuyển URL/chốt cutover khi chủ dự án đã kiểm tra bản đích.

## Phần chưa chuyển

Chưa có quyền triển khai Sites chuyển sang một dịch vụ khác, chưa có tài khoản hosting mới, chưa xuất dữ liệu/ảnh production hay thay đăng nhập. Những việc này đòi hỏi chính kết nối/tài khoản của người dùng; file ZIP không thể cấp thay.
