# Sổ Shop Quận 3 — web độc lập (index.html + Supabase so-shop-q3)

Đọc `HANDOFF.md` trước tiên: lịch sử, kiến trúc, schema Supabase, quy tắc nghiệp vụ, cách test, việc còn treo.

- Web chính thức: https://so-shop-quan-3.netlify.app (deploy = kéo thả lại thư mục lên Netlify).
- Supabase project ref: `jlwayvnokaxiapfaozew`. Hỏi người dùng trước khi đổi schema, xóa dữ liệu hay đổi RLS.
- Người dùng không phải lập trình viên: trả lời tiếng Việt, ngắn, nói rõ việc họ cần tự bấm.
- Sửa logic xuất Excel thì chạy lại `cd test && npm run excel` và kiểm tra file sinh ra.

## UI/UX skills

Taste, a11y, bans, voice, and icon library for this project live in `.ux-profile.md`.
Run `setup-ui-ux-skills` again only to change those defaults.
Before UI or microcopy work, read `.ux-profile.md`, then the matching domain skill (page-patterns, viewports, forms, surfaces, loaders, empty-states, copy, motion).
Before creating a new page, read `page-patterns` and name the pattern. Do not write page markup until the pattern is named.
Layouts must pass `viewports` at 375px and 1280px.
Before finishing UI, run `ux-audit`.
