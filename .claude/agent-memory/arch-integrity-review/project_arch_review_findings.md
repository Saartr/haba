---
name: project-arch-review-findings
description: Recurring/verified architecture facts found during 2026-06 review of auth.js, habits.js, lib/api.ts
metadata:
  type: project
---

Verified during 2026-06 arch review (Тапа/Haba habit app):

- **Refresh token model is single-session per user.** `POST /auth/vk` and `/auth/telegram-native` both run `DELETE FROM refresh_tokens WHERE user_id` before inserting — logging in on a new device invalidates all other devices. `/auth/refresh` rotates (delete old, insert new). Intentional but worth flagging if multi-device is ever a requirement.
- **No revocation check on access tokens.** `requireAuth` only verifies JWT signature/expiry; it does not check refresh_tokens table. A stolen 15-min access token stays valid until expiry even after logout/refresh-delete. Standard tradeoff for short-lived access tokens.
- **App rename Haba→Тапа is incomplete by design layer:** `app.json` name/slug + package.json name + legal text were renamed, but `scheme` stays `haba` and deeplinks are `haba://join/<code>` (server `/join/:code` and `app/_layout.tsx` both hardcode `haba://`). Android package is `pro.mihmih.haba`. Changing the scheme would break existing invite links — leave as-is.
- **AVATARS_DIR path fixed** from `/var/www/step-bot/...` to `/var/www/haba/backend/public/avatars` in both auth.js and index.js. The `step-bot` name survives only as the PM2 process name.
- **`source` validation asymmetry:** `/logs/sync` validates value range (0..200000) and source enum; plain `/logs` (manual) does NOT bound value (any number/type accepted as long as defined). 

**How to apply:** Use as baseline for future reviews; re-verify against current code before recommending. See [[project-migration-wiring]].
