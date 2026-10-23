# Chạy bản bàn giao trên máy

## Yêu cầu

Node.js tối thiểu 22.13 theo package.json; Node 24 đã được dùng để chạy bộ kiểm tra. Dự án khóa pnpm 11.25.0 trong packageManager/pnpm-lock.yaml. Không kèm node_modules.

Mở terminal tại thư mục `so-shop-quan-3`, sau đó:

```sh
node scripts/handoff-setup.mjs
npx --yes pnpm@11.25.0 install --frozen-lockfile
node node_modules/typescript/bin/tsc --noEmit
node scripts/test-shop.mjs
node scripts/test-evidence.mjs
npm run build
```

Lệnh npx tải đúng pnpm được khóa trong dự án. Nếu đã có pnpm đúng phiên bản, dùng `pnpm install --frozen-lockfile`. Không chạy `npm run install:ci` trên Mac: bản gốc có script tối ưu cho môi trường Linux được quản lý.

Script handoff-setup chỉ chọn cấu hình portable cho bản copy. Nó không đổi project ID, không tải dependency, không chạm web thật, không đăng nhập và không cấp quyền truy cập.

## Tạo database local sau build

Từ cùng thư mục, chạy migration **chỉ vào database local**:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_low_black_bird.sql
```

Đây là migration hiện có trong snapshot; nếu Claude bổ sung migration mới, áp dụng từng tệp mới theo thứ tự, không chạy lại tệp đã áp dụng. Database local tách biệt với D1 production. R2 local được mô phỏng trong trạng thái Wrangler; không có ảnh thật.

## Mở UI local

```sh
npm run dev
```

Bản portable mặc định dùng http://localhost:5173. Đọc URL thực được in trong terminal nếu khác. Mở URL đó rồi chọn Đăng nhập trong phần Bắt đầu sổ. Bản portable chỉ mô phỏng danh tính trên loopback bằng người dùng local; không phải tài khoản production và không có quyền đọc dữ liệu thật. Sau khi đăng nhập, tạo sổ trống, thêm nhân viên và nhập dữ liệu thử.

Nếu báo thiếu bảng shop_state, kiểm tra đã build và chạy migration local với đúng persist-to `.wrangler/state` (không tự thêm `/v3`). Nếu cổng bận, truyền cổng khác bằng `npm run dev -- --port 5174` và dùng đúng URL mới.

## Không nhầm chạy local với triển khai

`npm run build` tạo build output, không công bố website. `npm start` chạy Worker đã build tại máy qua Wrangler; không mô phỏng đầy đủ đăng nhập production. Muốn cập nhật URL Sites hiện tại, cần công cụ/quyền Sites được cấp hợp lệ; muốn triển khai riêng, đọc MIGRATION.md trước.
