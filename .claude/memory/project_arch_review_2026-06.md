---
name: arch-review-2026-06
description: Architectural integrity review results (2026-06-03) and fixes applied
metadata:
  type: project
---

## Arch Integrity Review (2026-06-03)

### 🔴 Критические фиксы — ИСПРАВЛЕНО

1. **`PATCH /auth/me` не возвращал `tg_id`/`vk_id`** → Добавлены в RETURNING и ответ. Теперь `GET /auth/me` и `PATCH /auth/me` возвращают одну форму `UserProfile`.

2. **`DELETE /habits/:id` = hard DELETE вместо soft-close** → Заменён на `UPDATE habits SET closed_at = now()`. Данные сохраняются для истории, `GET /habits` фильтрует `WHERE closed_at IS NULL`.

3. **`AVATARS_DIR` = `/var/www/step-bot/...` (legacy)** → Исправлен на `/var/www/haba/backend/public/avatars`. `index.js` static middleware тоже обновлён.

### 🟡 Предупреждения — ИСПРАВЛЕНО

1. **`POST /habits` и `POST /habits/join` не возвращали `is_creator`** → Добавлен `{ ...habit, is_creator: true/false }` в ответы.

2. **`verifyVkToken` URL через string interpolation** → Заменён на `URLSearchParams` (безопасное кодирование).

3. **`updateProfile` тип: `first_name?` вместо `first_name`** → Сделан обязательным (бэкенд требует непустую строку).

4. **`HabitLog` тип неполный** → Добавлены `id`, `habit_id`, `source`.

### 🏷️ Переименование Haba → Тапа

Приложение называется **Тапа** (tapa для латиницы в коде).

**Переименовано:**
- `app.json`: `name` → `"Tapa"` (латиница, безопаснее для Gradle-артефактов), `slug` → `"tapa"`
- `package.json`: `name` → `"tapa"`
- Юридические тексты (`legal/[type].tsx`): "приложения Haba" → "приложения Тапа"

**НЕ переименовано (системные идентификаторы, изменение сломает deeplinks/нативные модули):**
- `app.json` `scheme`: `"haba"` (deeplink `haba://join/...`, `haba://auth/callback`)
- `app.json` `android.package`: `"pro.mihmih.haba"`
- `lib/auth.ts` SecureStore keys: `haba_access_token`, `haba_refresh_token`, `haba_pending_invite`
- Native modules package: `pro.mihmih.haba.vkid`, `pro.mihmih.haba.tglogin`
- Backend deeplinks: `haba://join/...`

**Why:** Scheme и package — это системные идентификаторы Android. Смена сломает все deeplinks, App Links, нативные модули, и потребует переустановки приложения.

**How to apply:** Новые UI-строки и пользовательские тексты — «Тапа». Системные идентификаторы (scheme, package, SecureStore keys) — остаются `haba`.

### ✅ Что хорошо (подтверждено ревью)

- `tg_id` всегда `String()` — защита BIGINT-precision
- Clean removal legacy auth code
- Token refresh с retry
- Optimistic update с откатом
- Deeplink invite-флоу корректный
