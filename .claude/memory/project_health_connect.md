---
name: project-health-connect
description: Health Connect (Android step tracker) — статус интеграции и известные ограничения
metadata:
  type: project
---

**Статус:** частично реализовано, заблокировано на Google Play верификации.

**Что реализовано:**
- `lib/health.ts` — `isHealthConnectAvailable`, `hasStepsPermission`, `requestStepsPermission`, `getTodaySteps`, `openHealthConnectPermissions`
- `react-native-health-connect` v3.5.3
- `android/app/src/main/java/pro/mihmih/haba/MainActivity.kt` — `HealthConnectPermissionDelegate.setPermissionDelegate(this)` в `onCreate`
- `plugins/with-health-permissions.js` — добавляет `android.permission.health.READ_STEPS` в AndroidManifest
- Автосинк шагов в `app/(tabs)/habit/[id].tsx` через `useFocusEffect` — тихий, без Alert
- Кнопка "Подключить трекер" в модалке "Внести шаги" (только Android)
- Патч `node_modules/react-native-health-connect/.../HealthConnectPermissionDelegate.kt` — удалён `coroutineContext.cancel()` который убивал singleton coroutineScope после первого вызова

**Известное ограничение:**
`requestPermission()` возвращает пустой массив `[]` без показа диалога — Health Connect блокирует запросы от приложений не прошедших верификацию в Google Play Console.

**Why:** Google требует регистрацию в Play Console ($25 разово) и верификацию приложения перед тем как HC покажет диалог разрешений. Debug APK не проходит эту проверку. Developer Options в HC на данном устройстве не предоставляют обхода.

**Что нужно для разблокировки:**
1. Зарегистрировать Google Play Developer Account ($25)
2. Собрать release AAB: `./gradlew bundleRelease`
3. Залить в Play Console → Internal Testing
4. Установить через Play Store (тестовая ссылка) — тогда HC начнёт доверять приложению

**How to apply:** Не пытаться чинить `requestPermission` на debug APK — это ограничение Google, не баг кода. Когда появится Play Console — сразу собирать release AAB.
