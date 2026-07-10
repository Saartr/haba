---
name: project-migration-wiring
description: Boot migration runner (migrate.js) now folds in ALL schema — base, vk, phone, last_login_provider, habits, push, pullups, custom
metadata:
  type: project
---

As of 2026-07 review, `backend/src/db/migrate.js` (called by `index.js start()`) runs the FULL schema on boot — the earlier concern about VK/phone being standalone-only is RESOLVED:

- base tables (users/groups/goals/steps/auth_codes/refresh_tokens)
- `first_name/last_name/avatar_url` ALTERs
- VK: `ALTER COLUMN tg_id DROP NOT NULL`, `ADD vk_id`, partial unique index `users_vk_id_unique`
- `email`, `phone`, `last_login_provider` ALTERs
- then requires + runs: `migrate_habits`, `migrate_push`, `migrate_pullups`, `migrate_custom`

So a fresh DB booted via `start()` gets every column the API uses. `migrate_vk.js` and `migrate_phone.js` still exist as standalone files but their logic is now inlined into `migrate.js` (dead/redundant, not imported).

Custom columns migrated (`migrate_custom.js`): checkin_type, unit_preset, progression_start, periodicity, times_per_day, notification_times, times_per_week, times_per_month, month_count_type, month_dates, duration_type, period_start, period_end. Pullups (`migrate_pullups.js`): current_form, target_reps, intensity, training_days, pullups_plan (JSONB), pullups_session_index.

All use `IF NOT EXISTS` / idempotent DROP NOT NULL — safe to re-run.

**How to apply:** Migration wiring is no longer a gap. When reviewing schema changes, confirm new columns get added to one of these migration files AND that the file is required by `migrate.js`. See [[project-arch-review-findings]].
