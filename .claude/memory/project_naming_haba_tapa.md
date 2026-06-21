---
name: project-naming-haba-tapa
description: Приложение называется «Тапа» в UI, но системные идентификаторы (scheme, package, SecureStore keys) остаются haba
metadata:
  type: project
---

Приложение называется **Тапа** (`tapa` для латиницы в коде/конфигах). Переименовано в `app.json` (`name: "Tapa"`, `slug: "tapa"`), `package.json` (`name: "tapa"`), юридических текстах (`legal/[type].tsx`).

**НЕ переименовано (системные идентификаторы — смена сломает deeplinks/нативные модули/потребует переустановки):**
- `app.json` `scheme`: `"haba"` (deeplink `haba://join/...`, `haba://auth/callback`)
- `app.json` `android.package`: `"pro.mihmih.haba"`
- `lib/auth.ts` SecureStore keys: `haba_access_token`, `haba_refresh_token`, `haba_pending_invite`
- Native modules package: `pro.mihmih.haba.vkid`, `pro.mihmih.haba.tglogin`
- Backend deeplinks: `haba://join/...`

**Why:** Scheme и package — системные идентификаторы Android. Их смена ломает все deeplinks, App Links и нативные модули.

**How to apply:** Новые UI-строки и пользовательские тексты — «Тапа». Системные идентификаторы (scheme, package, SecureStore keys, native module package names) — остаются `haba`, не переименовывать.
