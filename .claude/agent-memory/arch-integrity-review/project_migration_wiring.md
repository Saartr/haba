---
name: project-migration-wiring
description: Boot migration runner only runs base tables + habits; VK/phone/email migrations are manual standalone scripts not wired into startup
metadata:
  type: project
---

The boot migration chain (`backend/src/db/migrate.js` → called by `index.js start()`) runs ONLY: base tables (users/groups/goals/steps/auth_codes/refresh_tokens), the `first_name/last_name/avatar_url` ALTERs, and `migrate_habits.js`.

`migrate_vk.js` (adds `vk_id`, drops `tg_id NOT NULL`, partial unique index) and `migrate_phone.js` (adds `email`, `phone`) are standalone scripts that self-execute when run directly with `node` — they are NOT imported by `migrate.js`. They were applied manually on the live server.

**Why it matters:** A fresh DB booted via `start()` would lack `vk_id`/`email`/`phone` columns and still have `tg_id NOT NULL`, breaking `POST /auth/vk` (inserts email/phone, ON CONFLICT vk_id) and `POST /auth/telegram-native` (would be fine, but VK users can't exist). The live server works only because the manual scripts were run once.

**How to apply:** When reviewing auth/schema changes, do not assume a column exists just because a manual migration file defines it. Recommend folding `migrate_vk` and `migrate_phone` logic into the `migrate.js` chain (they're idempotent — use IF NOT EXISTS / DROP NOT NULL is safe to re-run). See [[project-arch-review-findings]].
