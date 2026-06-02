---
name: project-health-connect
description: Health Connect (Android step tracker) — статус интеграции и известные ограничения
metadata:
  type: project
---

**Статус:** ✅ РАБОТАЕТ на debug APK (2026-06-02). Диалог разрешений показывается, шаги читаются. Play-верификация для разработки НЕ нужна.

**Что реализовано:**
- `lib/health.ts` — `isHealthConnectAvailable`, `hasStepsPermission`, `requestStepsPermission`, `getTodaySteps`, `openHealthConnectPermissions`
- `react-native-health-connect` v3.5.3
- `android/app/src/main/java/pro/mihmih/haba/MainActivity.kt` — `HealthConnectPermissionDelegate.setPermissionDelegate(this)` в `onCreate`
- `plugins/with-health-permissions.js` — добавляет `READ_STEPS` permission **И** Android-14 rationale `<activity-alias>` (см. ниже)
- Автосинк шагов в `app/(tabs)/habit/[id].tsx` через `useFocusEffect` — тихий, без Alert
- Кнопка "Подключить трекер" в модалке "Внести шаги"
- Патч `node_modules/react-native-health-connect/.../HealthConnectPermissionDelegate.kt` — удалён `coroutineContext.cancel()` который убивал singleton coroutineScope после первого вызова. ⚠️ Патч ручной, patch-package НЕ настроен — теряется при каждом `npm install`. После переустановки зависимостей патч надо накатывать заново (и затем пересобирать APK).

**РЕАЛЬНАЯ причина бывшего `requestPermission() = []` (НЕ верификация!):**
На Android 14+ встроенный Health Connect требует, чтобы приложение объявило rationale-экран через **`<activity-alias>`** с action `android.intent.action.VIEW_PERMISSION_USAGE`, категорией `android.intent.category.HEALTH_PERMISSIONS` и permission `android.permission.START_VIEW_PERMISSION_USAGE`. Без него HC молча отклоняет приложение и возвращает `[]` БЕЗ показа диалога. Старый `<intent-filter>` с `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` работает только на Android ≤13. Тестовое устройство CPH2745 — Android 14+, поэтому нужен alias. История про «нужна Google Play верификация» оказалась ложным следом — дело было чисто в манифесте.

`activity-alias` добавляется через `plugins/with-health-permissions.js` (функция `ensureRationaleAlias`). После правки плагина — `npx expo prebuild --platform android` (alias попадает в `android/app/src/main/AndroidManifest.xml`), затем пересобрать APK.

**How to apply:** HC работает на debug — НЕ списывать проблемы с разрешениями на «верификацию Google». Если `requestPermission` возвращает `[]` на Android 14+ — проверять наличие rationale `activity-alias` в манифесте в первую очередь. Play-верификация ($25) нужна только для публикации в проде (release из Play Store), не для локальной разработки.
