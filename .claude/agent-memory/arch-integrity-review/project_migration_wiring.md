---
name: project-migration-wiring
description: Boot migration runner (migrate.js) folds in ALL schema; legacy bot tables and tg_id dropped 2026-08-25
metadata:
  type: project
---

As of 2026-07 review, `backend/src/db/migrate.js` (called by `index.js start()`) runs the FULL schema on boot — the earlier concern about VK/phone being standalone-only is RESOLVED:

- base tables (users/refresh_tokens)
- `first_name/last_name/avatar_url` ALTERs
- VK: `ADD vk_id`, partial unique index `users_vk_id_unique`
- Yandex (`migrate_yandex.js`): `yandex_id` + partial unique index, `yandex_avatar_id`
- `migrate_drop_legacy.js` (runs last): DROPs steps/auth_codes/goals/group_members/groups and `users.tg_id`
- `email`, `phone`, `last_login_provider` ALTERs
- then requires + runs: `migrate_habits`, `migrate_push`, `migrate_pullups`, `migrate_custom`

So a fresh DB booted via `start()` gets every column the API uses. `migrate_vk.js` was DELETED 2026-08-25 (it was dead code that would now crash: it referenced the dropped `tg_id`). `migrate_phone.js` still exists as dead/redundant code, not imported.

Custom columns migrated (`migrate_custom.js`): checkin_type, unit_preset, progression_start, periodicity, times_per_day, notification_times, times_per_week, times_per_month, month_count_type, month_dates, duration_type, period_start, period_end. Pullups (`migrate_pullups.js`): current_form, target_reps, intensity, training_days, pullups_plan (JSONB), pullups_session_index.

All use `IF NOT EXISTS` / idempotent DROP NOT NULL — safe to re-run.

**How to apply:** Migration wiring is no longer a gap. When reviewing schema changes, confirm new columns get added to one of these migration files AND that the file is required by `migrate.js`. See [[project-arch-review-findings]].
