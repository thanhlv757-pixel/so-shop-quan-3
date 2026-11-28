# Giao diện Claude + nhập số vợt mới — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi toàn bộ giao diện `index.html` sang phong cách app Claude (cam đất, chữ ≥ 13px, bản tối) và thay bảng đan vợt bằng hai chế độ nhập "Theo ngày" / "Theo từng người" ghi vào Supabase.

**Architecture:** Một file `index.html` vanilla JS, render bằng chuỗi HTML vào `#main` (`render()` → `VIEW_FN[view]()`), focus được khôi phục theo `id`. CSS đổi tại chỗ qua token `:root`. Trang Đan vợt viết lại trong `VIEW_FN.strings`, lưu qua hàm mới có gộp lưu theo ngày.

**Tech Stack:** HTML/CSS/JS thuần, `@supabase/supabase-js@2.45.4` (CDN), Google Fonts (Inter, Source Serif 4), Playwright (cài sẵn trong máy) cho test.

**Spec:** `docs/superpowers/specs/2026-11-24-giao-dien-claude-design.md`

## Global Constraints

- Không đổi schema/RLS/Edge Function Supabase; bảng `strings` vẫn `{date, counts jsonb {tên: số}, updated_at}`, upsert theo `date`.
- Không đổi `buildWorkbook`/`parseDepositText` và quy tắc KPI (`kpi_target` 450, `rate_low` 5000, `rate_high` 10000 áp cho cả tháng).
- Không thêm thư viện JS, không bước build.
- Màu sáng/tối: nền `#f5f4ef`/`#262624`, thẻ `#fffefb`/`#30302d`, chữ `#1f1e1b`/`#ecebe6`, chữ phụ `#6b6a63`/`#a6a49b`, viền `#e3e0d6`/`#3b3a36`, nhấn `#c96442`/`#e08b6b`.
- Chữ nội dung 16px, không chữ nào < 13px; mục chạm ≥ 44px trên màn cảm ứng.
- Số vợt: số nguyên 0–200; ngày sau hôm nay (giờ Asia/Ho_Chi_Minh) bị khóa.
- Gộp lưu: 600 ms sau lần thay đổi cuối của một ngày thì upsert một lần.

## Review Focus

1. Bấm + nhiều lần cho 2 người khác nhau cùng ngày trong 600 ms → cả hai số đều được gửi trong một upsert, không mất số nào.
2. Đổi ngày / đổi người / rời trang khi còn số chưa lưu → số đó vẫn được gửi (flush ngay khi đổi).
3. Lỗi mạng khi lưu → số trên màn hình và `S.strings` quay về giá trị trước, báo lỗi.
4. Tháng cũ (không phải tháng hiện tại) → mở được mọi ngày của tháng đó; tháng hiện tại → chỉ đến hôm nay.
5. Chưa có nhân viên → hiện trạng thái trống có nút mở Cài đặt (giữ như cũ).

---

### Task 1: Test cho trang Đan vợt mới (đỏ trước)

**Files:**
- Create: `test/fixture.js` (dữ liệu giả + hàm mở trang với Supabase giả lập, dùng chung cho Task 1 và 3)
- Create: `test/strings.js`
- Modify: `test/package.json` (script `"strings": "node strings.js"`, `"shots": "node shots.js"`)

**Interfaces:**
- Produces: `openApp({ width, height, mobile, dark, failWrites }) -> { page, writes, errors, close }` trong `test/fixture.js`; `writes` là mảng `[method, path, body]` của mọi ghi lên `/rest/`.

- [ ] Step 1: Viết `test/fixture.js`: giả lập như `test/ui.js` nhưng dữ liệu nằm trong file (nhân viên `['Thành','Thái','Bình']`, 2 khoản chi giả, 3 ngày `strings`, 1 cọc), giờ đồng hồ trình duyệt cố định 2026-11-24 12:00 (+07), `failWrites` trả lỗi 500 cho mọi ghi.
- [ ] Step 2: Viết `test/strings.js` với các khẳng định:
  - mở `#strings`: có nút `#sv-mode-day`, `#sv-mode-emp`; mặc định chế độ ngày, ngày đang mở là hôm nay `24/11`.
  - chế độ ngày: gõ `5` vào `#sv-d-0`, Enter → focus `#sv-d-1`; bấm `[data-sv-step="1"][data-emp="Thái"]` 3 lần; chờ 900 ms → đúng **1** upsert `strings` với `date 2026-11-24`, `counts` chứa `Thành: 5, Thái: 3`.
  - chế độ người: bấm `#sv-mode-emp`, chọn `Bình`, gõ `7` vào `#sv-p-2026-11-01`, Enter → focus `#sv-p-2026-11-02`; chờ → upsert ngày `2026-11-01` có `Bình: 7` và giữ số cũ của người khác ngày đó.
  - đổi ngày trước 600 ms → upsert vẫn gửi (Review Focus 2).
  - `failWrites`: bấm + → sau lỗi, ô quay về số cũ và có toast lỗi (Review Focus 3).
  - không có `pageerror`.
- [ ] Step 3: Chạy `cd test && node strings.js` → FAIL (chưa có `#sv-mode-day`).
- [ ] Step 4: Commit `test: kiểm tra nhập số vợt mới`.

### Task 2: Trang Đan vợt hai chế độ

**Files:**
- Modify: `index.html` — `VIEW_FN.strings` (~dòng 740–757), khối "String cell autosave" (~1056–1077), handler `click`/`keydown`/`input`/`change` (~1130–1185), CSS mới cho `.sv-*`.

**Interfaces:**
- Consumes: `S`, `stats()`, `today()`, `daysIn()`, `render()`, `toast()`, `friendly()`, `must()`, `cacheNow()`.
- Produces: `S.sv = { mode: 'day'|'emp', day: 'YYYY-MM-DD', who: string }`; `setCount(date, emp, value)`; `flushCounts()`.

- [ ] Step 1: `setCount(date, emp, v)`: kẹp 0–200, cập nhật `S.strings` ngay (lạc quan), ghi nhớ bản trước của ngày đó (lần đầu trong lượt gộp), hẹn upsert sau 600 ms theo `date`. `flushCounts()` gửi ngay mọi ngày đang chờ; gọi khi đổi ngày/người/chế độ/tháng/trang và `pagehide`. Lỗi → trả `counts` về bản trước, `render()`, `toast(friendly(e))`. Bỏ `saveStringCell`/`strTimers`/`.cell-input`.
- [ ] Step 2: `VIEW_FN.strings`: tóm tắt tháng (tổng/450, thanh tiến độ, câu "Còn N cây để lên …"), nút chế độ, chế độ ngày (nút ‹ › với id `sv-prev`/`sv-next`, mỗi người: `−`, ô `#sv-d-<i>`, `+`; tổng ngày; nút "Xong ngày này · sang ngày sau"; lịch tháng nút `[data-sv-day]`), chế độ người (nút chọn người `[data-sv-who]`, danh sách ngày với ô `#sv-p-<date>`), thẻ tiền công từ `stats().per`. Ngày tối đa = `min(cuối tháng, today())`. Ô nhập dùng `inputmode="numeric" enterkeyhint="next"`, chọn hết khi focus.
- [ ] Step 3: Enter: ngày → người kế, hết người → ngày kế (`flush` + đổi ngày); người → ngày kế. Ô nhập gọi `setCount` trên sự kiện `input` (không render lại toàn trang khi đang gõ; chỉ cập nhật các số tổng qua `updateStringTotals()`).
- [ ] Step 4: `node strings.js` → PASS. Commit `feat: nhập số vợt theo ngày hoặc theo người`.

### Task 3: Giao diện phong cách Claude

**Files:**
- Modify: `index.html` `<head>` (Google Fonts, `theme-color`, favicon màu), toàn bộ `<style>`.
- Modify: `.ux-profile.md`.
- Create: `test/shots.js`.

- [ ] Step 1: `test/shots.js`: với `openApp` ở 1280×860 và 375×812 (mobile), sáng và tối, mở mọi trang + form thêm khoản chi; chụp vào `test/shots/`; khẳng định: không `pageerror`, `scrollWidth <= innerWidth`, mọi phần tử có chữ hiển thị có `font-size >= 13px`. Chạy → FAIL (chữ 11–12px hiện có).
- [ ] Step 2: Đổi token `:root` theo Global Constraints, thêm khối tối `@media (prefers-color-scheme: dark)` (chỉ đổi token, `color-scheme: dark`); thay mọi màu viết cứng (`#fff`, `rgba(...)` nền) bằng token; chữ nội dung 16px, thang 13/14/16/19/22–26/30px, tiêu đề `h1`/`h2` dùng Source Serif 4; `.card` bo 16px, viền 1px, bỏ bóng; nút chính nền cam đất.
- [ ] Step 3: Chạy `node shots.js` → PASS; xem ảnh chụp, sửa chỗ vỡ.
- [ ] Step 4: Cập nhật `.ux-profile.md` (chuẩn: phong cách app Claude; nhấn cam đất; có bản tối; Source Serif 4 + Inter). Commit `style: giao diện phong cách Claude`.

### Task 4: Kiểm tra cuối và bàn giao

- [ ] Step 1: `cd test && npm run excel` → sinh `out.xlsx` không lỗi (cần `migration/`; nếu thiếu, chạy `node extract-builder.js` và ghi rõ là không chạy được phần sinh file).
- [ ] Step 2: Rà toàn bộ diff (ponytail-review). Sửa điều cần sửa, chạy lại `strings.js` và `shots.js`.
- [ ] Step 3: Push nhánh; gửi ảnh chụp cho người dùng; **chỉ gộp vào `main` khi người dùng đồng ý**.
