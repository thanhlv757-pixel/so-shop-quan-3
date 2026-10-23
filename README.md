# Sổ Shop · Quận 3

**Bàn giao cho Claude:** đọc [CLAUDE.md](CLAUDE.md), [BAN_GIAO.md](BAN_GIAO.md) và [hướng dẫn chạy local](docs/LOCAL_SETUP.md). Kho nguồn này thuộc chủ dự án; việc push lên GitHub không tự cập nhật website Sites. Nội dung gửi cho Claude có trong [PROMPT_CHO_CLAUDE.txt](PROMPT_CHO_CLAUDE.txt).

Ứng dụng riêng tư theo dõi quỹ chi, số vợt đan và khách cọc. Ba file Excel được cung cấp chỉ là tham khảo cấu trúc. Ứng dụng mới bắt đầu trống: không cài dữ liệu mẫu về nhân viên, khoản chi, số vợt, quỹ hay khách cọc. Dữ liệu người dùng đã lưu vẫn được giữ nguyên.

## Bắt đầu

Đăng nhập, tạo sổ trống, thêm nhân viên và thiết lập quỹ đầu tháng. Ghi nhiều khoản chi trong một ngày. Mỗi khoản có ba mã riêng: mã đơn app giao hàng, mã đơn chuyển và mã đơn bán cho khách; không bắt buộc điền mã. Nhập tổng số vợt trong ngày của từng nhân viên; nhập lại cùng ngày sẽ cập nhật tổng, không cộng dồn.

## Tiền công đan vợt

KPI tính trên **tổng số vợt cả cửa hàng trong tháng**:

- Dưới 450 cây: 5.000đ/cây.
- Từ 450 cây trở lên: 10.000đ/cây.

Đơn giá áp dụng cho **toàn bộ** vợt của tháng, không chỉ phần vượt KPI. Tiền công từng người = số vợt người đó đan trong tháng × đơn giá chung của tháng. 449 cây → tổng công 2.245.000đ; 450 cây → tổng công 4.500.000đ. Tổng số vợt giảm dưới ngưỡng sau khi chỉnh sửa sẽ khiến đơn giá tự trở về 5.000đ.

Đây là tiền công dự tính theo dữ liệu hiện tại, chưa gồm lương cố định, phụ cấp hoặc khấu trừ, chưa tự trừ vào quỹ chi. Khi thanh toán thực tế, ghi một khoản chi tương ứng nếu cần theo dõi trong quỹ.

## Khách cọc và báo cáo

Theo dõi vợt, giày, balo, phụ kiện, quần áo hoặc nhóm khác; tên/mã sản phẩm, size/màu/phiên bản, số lượng, tiền cọc, ngày nhận và ngày hoàn tất. Mỗi khách có nền tảng đã liên hệ (Zalo, Facebook/Messenger, Instagram, TikTok, điện thoại, tại shop hoặc khác) và tài khoản/đường dẫn tương ứng. Đây là sổ ghi nhận kênh liên hệ, không tự đăng nhập các mạng xã hội. Cọc đang chờ được giữ xuyên tháng. Đã giao/đã hoàn toàn bộ cọc thì không còn tính vào cọc đang giữ. Không thực hiện giao dịch tiền thật.

Xuất Excel tổng hợp 4 trang tính hoặc riêng từng bảng. Trang Đan vợt gồm số lượng theo ngày và bảng tiền công từng nhân viên, với công thức IF kiểm tra KPI và công thức tính tiền công; chỉnh số vợt trong Excel sẽ cập nhật đơn giá và tiền công sau tính lại. Tổng quan liên kết đến các bảng chi tiết. Phạm vi khách cọc là tất cả cọc còn chờ và các cọc nhận/hoàn tất trong tháng.

Sao lưu JSON giữ dữ liệu và tham chiếu ảnh, khôi phục cần xác nhận thay thế. JSON không chứa nội dung tệp ảnh; ảnh giữ theo tài khoản sở hữu, không tự chuyển sang tài khoản khác. Xuất Excel kèm ảnh để giữ bản chứng từ xem ngoại tuyến. Chưa có phân quyền nhiều tài khoản, nhập Excel tùy ý hoặc đồng bộ POS. Tên nhân viên đã tạo được giữ để bảo toàn lịch sử.

## Lưu trữ và kiểm tra

D1 lưu theo ID tài khoản nền tảng xác thực; API từ chối thiếu danh tính, kiểm tra dữ liệu và dùng compare-and-swap tránh ghi đè từ thiết bị khác. Bản ghi cũ được bổ sung trường trống khi đọc/lưu; không đổi schema D1 trong lần cập nhật này. R2 lưu nội dung ảnh trong namespace băm từ ID tài khoản; endpoint ảnh yêu cầu danh tính hợp lệ và không cho đọc chéo tài khoản.

```
node node_modules/typescript/bin/tsc --noEmit
node scripts/test-shop.mjs
node scripts/test-evidence.mjs
```

Bộ kiểm tra dùng dữ liệu tổng hợp, không dùng dữ liệu trong file người dùng. Kiểm tra các mốc 0/449/450/451, tính tiền công từng người, sửa giảm KPI, tách tháng, công thức file Excel, kiểm tra API, cách ly tài khoản và xung đột phiên bản. Trình duyệt xem thử đang bị môi trường chặn, nên chưa xác minh trực quan bố cục.


## Ảnh bằng chứng khoản chi

Cột cuối sổ chi cho phép thêm tối đa 3 ảnh mỗi khoản; nhiều khoản cùng ngày vẫn có ảnh riêng. Chọn JPG, PNG hoặc WebP, tối đa 12 MB/ảnh gốc. Trình duyệt tối ưu về JPEG, tối đa 1600px và 2 MB trước khi tải lên. Ảnh chỉ tải lên khi bấm Lưu; lỗi tải ảnh hoặc lỗi lưu không báo thành công giả.

Có xem ảnh lớn, chuyển ảnh và tải ảnh. Gỡ ảnh khỏi khoản chi chỉ bỏ liên kết của bản ghi; không xóa nội dung ảnh cũ, giữ khả năng khôi phục tham chiếu từ bản JSON của cùng tài khoản. Chưa có giao diện dọn ảnh không còn tham chiếu.

Khi xuất Excel tổng hợp hoặc sổ chi, mặc định nhúng ảnh trực tiếp vào cột cuối, tăng chiều cao đúng dòng khoản chi. Nội dung ảnh tối đa 1600px được giữ để phóng lớn trong Excel. Có thể bỏ chọn ảnh khi xuất; nếu không tải được ảnh, ứng dụng báo lỗi và cho thử lại hoặc xuất không kèm ảnh, không âm thầm bỏ sót chứng từ. Mã giao hàng, đơn chuyển, đơn bán; loại sản phẩm; kênh và tài khoản khách đều có cột riêng trong Excel.

Bộ kiểm tra bổ sung bao gồm ảnh không hợp lệ/quá dung lượng, chặn yêu cầu thiếu danh tính và đọc chéo tài khoản, nâng cấp bản ghi cũ, năm loại sản phẩm, ba mã đơn, giới hạn số ảnh, cấu trúc nhúng ảnh OOXML và vị trí ảnh trong file Excel. Chưa kiểm thử trực quan do công cụ xem thử bị môi trường chặn.


### Dán ảnh bằng chứng

Trong hộp Thêm/Sửa khoản chi, sao chép ảnh hoặc ảnh chụp màn hình, bấm vùng dán ảnh rồi Ctrl+V (Windows) hoặc ⌘V (Mac). Cũng có thể dán ảnh khi đang nhập trong hộp này; chỉ nội dung clipboard là ảnh mới được xử lý, văn bản thông thường vẫn dán vào ô đang nhập. Ảnh dán dùng cùng hàng chờ, giới hạn 3 ảnh, kiểm tra định dạng/dung lượng và cách lưu như ảnh chọn từ tệp. Không yêu cầu đọc clipboard nền; chỉ nhận dữ liệu từ thao tác dán của người dùng. Bấm Lưu để tải ảnh và lưu cùng khoản chi.


## Phân loại khoản chi và số hóa đơn

Mục Quỹ chi có các nhóm riêng: Tất cả khoản chi, Chi theo đơn hàng, Chi nội bộ và Chưa phân loại. Chi nội bộ gồm Mua dụng cụ, Hỗ trợ tiền xăng, Chi nội bộ khác; có thể lọc riêng từng loại và nhập mới ngay trong nhóm này.

Tổng tiền chi = chi theo đơn hàng + chi nội bộ + khoản chưa phân loại. Tất cả đều trừ vào quỹ tháng. Số hóa đơn chỉ đếm số dòng phân loại **Chi theo đơn hàng**, mỗi dòng tính 1; không đếm ba mã đơn thành ba hóa đơn và không gộp/khử trùng mã. Chi nội bộ không tính số hóa đơn, kể cả có mã biên nhận hoặc chứng từ. Các mã đơn vẫn được giữ khi đổi loại khoản chi.

Bản ghi cũ chưa có trường phân loại được gán Chưa phân loại khi đọc; không suy đoán theo nội dung hoặc việc có mã đơn. Chúng vẫn cộng tổng tiền chi nhưng chưa cộng số hóa đơn, và giao diện hiện số khoản cần phân loại. Người dùng sửa lại loại để thống kê hóa đơn đúng. Không tự ghi đè dữ liệu đang lưu hoặc xóa bản ghi cũ.

Excel Quỹ chi có cột Phân loại khoản chi; cột ảnh chuyển sang cột I, vẫn giữ đúng dòng. Tổng tiền có SUM, số hóa đơn có COUNTIF theo phân loại; chi nội bộ có SUMIF theo ba loại. Tổng quan liên kết đến các kết quả này. Bộ kiểm tra xác nhận chi nội bộ có mã chứng từ không tăng số hóa đơn, thay đổi phân loại cập nhật số đếm nhưng không đổi tổng tiền, tách tháng, đọc bản ghi cũ và lưu/đọc lại qua API.
