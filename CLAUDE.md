# Sổ Shop · Quận 3 — instructions for the next coding assistant

## Current task: standalone web

The user requested an independent web app outside Sites on 2026-10-23. Work in `standalone/` and read `standalone/README.md` first. It has its own Node 24 server, login, SQLite and local evidence storage. The root app is the retained Sites version; leave its deployment and live data unchanged. Hosting authorization and actual data/image migration are still pending. Do not claim an online URL until deployment is verified.


Read `BAN_GIAO.md`, `docs/LOCAL_SETUP.md` and `docs/MIGRATION.md` before editing. The user authorizes continuing development of their existing app. They are a shop employee, not a programmer; communicate concisely in Vietnamese.

## Existing project

- Sites project ID: `appgprj_6adaf817e6b48191b0f192dee3439e6c`.
- Live URL: https://so-shop-q3-thanh.thanhlv757.chatgpt.site
- Source snapshot commit is in `HANDOFF_MANIFEST.json`.
- Preserve the existing project identity, private audience, D1 data and R2 images when working through Sites. Do not create a replacement Site unless the user requests migration.
- This source package is not a credential. Discover the available Sites tools, inspect this exact project and establish authorized access through the user's own connection. Never fabricate access, reuse old tokens, or claim deployment from a mere GitHub push.

## Business invariants

1. Monthly KPI is **450 rackets across the whole shop**, not 450 per employee.
2. Below 450: 5,000 VND/racket. At or above 450: 10,000 VND/racket for **every racket in that month**, including those before crossing the threshold. Each employee receives their own monthly racket count multiplied by the common monthly rate. Editing below threshold recalculates the entire month's rate. Amounts are estimates, not payroll transfers.
3. Every expense reduces the monthly fund. Only category `Chi theo đơn hàng` increases `invoiceCount`, one invoice per expense row. Three codes do not create three invoices; identical codes are not deduplicated by current policy. `Mua dụng cụ`, `Hỗ trợ tiền xăng`, `Chi nội bộ khác` never increase the invoice count, even if they have document codes.
4. Old expenses without a category become `Chưa phân loại` and keep their amount. They count toward spending, not invoice count until classified. Do not guess classification based on text/codes.
5. Shipping code, transfer code and customer sales-order code are separate optional strings; preserve leading zeros and prior values when recategorizing.
6. Deposits are not revenue and do not enter the shop expense fund. Waiting deposits persist across months. Delivered/refunded deposits stop being held, with a completion date. Refund status means full refund only.
7. Product categories include rackets, shoes, backpacks, accessories, clothing and other. Contact platform/account is a manually recorded communication channel, not an active Zalo/Facebook integration.
8. Up to 3 private evidence photos per expense. File picker and Ctrl+V/Command+V share the pending-photo queue and limits. Text-only paste remains normal. Photos upload when Save is pressed, and belong to the individual expense, not every expense on the same date.
9. Start new workspaces empty. Original spreadsheets were structure references only; no imported customer/transaction demo records.
10. JSON backup stores data and image IDs, not image bytes. Excel can embed private evidence in the last expense column (I). Maintain formulas, cached values and correct image row alignment.

## Engineering constraints

- Stack: React 19 + TypeScript + Vinext/Vite + Cloudflare Workers, D1 binding `DB`, R2 binding `BUCKET`.
- D1 `shop_state` stores a validated JSON payload per authenticated user with optimistic revision checking. Do not replace it with browser-only storage.
- Auth headers beginning `oai-authenticated-user-` are trusted only behind Sites dispatch. A standalone deployment needs real server-verified authentication and owner isolation; never accept arbitrary client-supplied IDs in production.
- Photo namespaces hash user IDs. If identity changes during migration, data ownership and R2 keys need an explicit mapping.
- Never include tokens, .env files, .wrangler state, live financial records or customer photos in a source repository.
- Run the appropriate checks described in LOCAL_SETUP.md. Browser layout, upload and paste interactions still require real browser verification; earlier checks did not cover them visually.
- Do not remove existing functions just to simplify a migration. Report real blockers and what has or has not actually been transferred.
