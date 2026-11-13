# Bàn giao: Sổ Shop Quận 3 (chuyển từ Claude Cowork sang Claude Code)

Tóm tắt toàn bộ phiên làm việc ngày 12–13/11/2026, để Claude Code làm tiếp mà không cần đọc lại cuộc trò chuyện.

## Người dùng & mục tiêu

- Chủ sổ: nhân viên bán hàng Vợt Cầu Lông Shop – Chi nhánh Quận 3, không phải lập trình viên. Trả lời bằng tiếng Việt, ngắn gọn, không bịa số liệu; thiếu dữ kiện thì hỏi lại.
- Yêu cầu gốc: làm lại toàn bộ giao diện Sổ Shop, tách thành web riêng phản hồi nhanh hơn, xuất Excel chỉn chu.

## Lịch sử

1. Bản đầu: ChatGPT Sites (`so-shop-q3-thanh.thanhlv757.chatgpt.site`), repo GitHub `thanhlv757-pixel/so-shop-quan-3`.
2. Bản thứ hai: trang Claude artifact `https://claude.ai/artifact/DEfXDWHprsLhnmVFXz3NfH` (React build, dữ liệu trong DB của artifact). Chậm: mỗi lần mở tải toàn bộ các tháng, timeout 12 giây. **Giờ chỉ là bản lưu, không ghi thêm vào đây.**
3. Bản hiện tại (dùng chính thức): **https://so-shop-quan-3.netlify.app** = file `index.html` trong thư mục này + Supabase.

## Kiến trúc hiện tại

- **Frontend:** một file `index.html`, vanilla JS, không build. Thư viện qua CDN (ghim phiên bản):
  - `@supabase/supabase-js@2.45.4` (UMD, tải khi mở trang)
  - `exceljs@4.4.0` (chỉ tải khi bấm Xuất Excel)
- **Hosting:** Netlify Drop, site `so-shop-quan-3`. Cập nhật = kéo thả lại thư mục chứa `index.html` vào trang Deploys của site trên Netlify (không có CI).
- **Backend:** Supabase project `so-shop-q3`, ref `jlwayvnokaxiapfaozew`, region ap-southeast-1 (Singapore), gói Free (tự tạm dừng nếu 7 ngày không dùng → vào dashboard bấm Restore).
  - URL: `https://jlwayvnokaxiapfaozew.supabase.co`
  - Khóa publishable (công khai, đã nằm trong index.html): `sb_publishable_JmUVQ8pw4H-9Fh_R78gN7A_O9Dj3O3P`
  - Không có service key trong repo. Không bao giờ đưa service key vào index.html.

### Schema (public)

| Bảng | Khóa | Ghi chú |
|---|---|---|
| `members` | `email` (lowercase) | Danh sách email được dùng sổ. Hiện có: thanhlv757@gmail.com |
| `settings` | `id = 1` | `employees text[]` (Thành, Thái, Bình), `kpi_target` 450, `rate_low` 5000, `rate_high` 10000 |
| `budgets` | `month` char(7) `YYYY-MM` | `amount` bigint |
| `expenses` | `id uuid` | `date, amount, category, purpose, detail, invoice, sales_order_code, transfer_code, evidence jsonb [{path,name,size,type}]` |
| `strings` | `date` | `counts jsonb {tên nhân viên: số vợt}` |
| `deposits` | `id uuid` | `customer, phone, contact_platform, contact_handle, category, product, variant, quantity, date, amount, status (Đang chờ/Đã giao/Đã hoàn cọc), closed_date, note` |

- RLS bật trên mọi bảng: chỉ `authenticated` VÀ `public.is_member()` mới đọc/ghi. `is_member()` là SECURITY DEFINER, so email trong JWT với bảng `members` (advisor cảnh báo — chấp nhận có chủ đích, vì nó chỉ trả boolean của chính người gọi).
- `members`: thành viên được select/insert/delete (không tự xóa chính mình).
- Storage bucket `evidence` (private, ≤2 MB, chỉ image/jpeg). Đường dẫn ảnh mới: `{expenseId}/{uuid}.jpg`; ảnh chuyển từ bản cũ: `migrated/{assetId}.jpg`. Hiển thị bằng signed URL 6 giờ.
- **Việc còn treo:** policy `tmp_migration_insert` trên `storage.objects` đã bị vô hiệu (`with check (false)`) nhưng chưa xóa — lệnh DROP cần người dùng bấm Approve trong Supabase. Muốn dọn: `drop policy if exists tmp_migration_insert on storage.objects;`

### Quy tắc nghiệp vụ (giữ nguyên từ bản cũ)

- Phân loại chi: Chi theo đơn hàng · Mua dụng cụ · Hỗ trợ tiền xăng · Chi nội bộ khác · Chưa phân loại. Chỉ "Chi theo đơn hàng" tính là hóa đơn; 3 loại giữa là "chi nội bộ".
- KPI đan vợt tính cả shop theo tháng: tổng ≥ `kpi_target` → `rate_high`/cây, ngược lại `rate_low`/cây, áp dụng cho toàn bộ số vợt. Tổng vợt chỉ cộng nhân viên đang có trong `settings.employees`.
- Tiền cọc theo dõi riêng, không trừ quỹ chi. Ngày chờ = (ngày hoàn tất hoặc hôm nay) − ngày cọc.
- Không cho nhập ngày trong tương lai (giờ Asia/Ho_Chi_Minh).

### Dữ liệu đã chuyển & đối chiếu (khớp 100%)

Tháng 10/2026: quỹ 500.000đ · 6 khoản chi = 407.000đ · 31 ngày đan vợt = 357 cây (Thành 181, Thái 39, Bình 137) · 11 ảnh bằng chứng · 0 khách cọc. Bản JSON gốc: `migration/months/2026-10.json` (ảnh gốc: `migration/images/`).

## Xuất Excel

Hàm thuần `buildWorkbook(ExcelJS, d)` trong `<script id="xlsx-builder">` của index.html (export qua `module.exports` để test bằng Node). 4 sheet: Tổng quan tháng · Chi phí chi tiết · Đan vợt & lương KPI · Tiền cọc. Arial, định dạng `#,##0" đ"`, ngày là số serial Excel, tổng/đơn giá bằng công thức (có cached result), freeze header, A4, ảnh bằng chứng tùy chọn (thu nhỏ 480px).

## Điền khách cọc từ ảnh (thêm 13/11/2026)

Form "Thêm khách đặt cọc" có ô "Chọn ảnh" (tối đa 3 ảnh tin nhắn / chuyển khoản). Đọc chữ ngay trong trình duyệt bằng `tesseract.js@5.1.1` (CDN, chỉ tải khi dùng, tiếng Việt) — không gửi ảnh đi đâu, không lưu ảnh, không đụng Supabase. Hàm thuần `parseDepositText(text, today)` nằm trong `<script id="xlsx-builder">`; `fillDepositFromImages` chỉ điền ô trống (riêng ngày và loại sản phẩm thay giá trị mặc định), không tự lưu. Giới hạn đã biết: sai dấu tiếng Việt ở tên, ngày trên ảnh chuyển khoản nhỏ hay đọc sai (ngày vô lý thì bỏ), chưa hiểu "1tr2". **Cập nhật cùng ngày:** người dùng chọn thêm Gemini (khóa API tự tạo ở AI Studio, biết gói miễn phí cho Google dùng dữ liệu). Nút "Chọn ảnh" giờ gọi Edge Function `read-deposit` trước (mã nguồn: `supabase/functions/read-deposit/index.ts`, đã deploy v1, `verify_jwt` bật + kiểm `is_member()`, secret `GEMINI_API_KEY`, model `gemini-3.5-flash-lite`, Interactions API `v1beta/interactions`); lỗi hoặc hết lượt thì tự lùi về Tesseract. **Chưa thử thật với khóa** — dạng JSON trả về của REST chưa có tài liệu xác nhận, nếu lỗi xem log function (`gemini …` / `unparsable`). Test: `node extract-builder.js && node parse.js`.

## Kiểm thử (thư mục `test/`)

```
cd test
npm install            # exceljs, supabase-js, playwright
npx playwright install chromium   # lần đầu
npm run excel          # trích builder rồi sinh file Excel thử
# (npm run excel) sinh out.xlsx / out_img.xlsx / out_empty.xlsx từ builder
node ui.js             # Playwright, mock Supabase + CDN, chụp màn hình 1280 & 375 vào test/shots/
node login.js          # màn đăng nhập + sai mật khẩu
```


Kết quả lần cuối: không lỗi JS, không tràn ngang ở 375px, LibreOffice recalc 0 lỗi công thức, giá trị cache khớp giá trị tính lại.

## UX

Đọc `.ux-profile.md` (Stripe, WCAG AA, giọng ngắn gọn, icon Lucide inline) và `CLAUDE.md` trước khi sửa giao diện. Mẫu trang: Tổng quan = Dashboard; Quỹ chi / Đan vợt / Khách cọc = List; Báo cáo = Analytics; Cài đặt = Settings; Đăng nhập = Form (auth). Form thêm/sửa = slide-over (`<dialog class="sheet">`), xóa = hộp xác nhận nêu tên bản ghi.

## Chưa làm / có thể làm tiếp

- Giao diện tối (dark mode).
- Nút sao lưu ra JSON (Supabase Free đã tự backup hằng ngày).
- Đổi tên nhân viên (hiện chỉ thêm/xóa; xóa chỉ ẩn cột, số liệu cũ vẫn giữ).
- Cảnh báo khi Supabase sắp tạm dừng do không dùng.
- Người dùng cần: bấm **Make public** trên Netlify để nhân viên mở được link; tạo tài khoản nhân viên ở Supabase → Authentication → Add user (tick Auto Confirm), rồi cấp quyền trong Cài đặt của web.
