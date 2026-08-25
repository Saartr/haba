---
name: infra-android-native
description: "Нативные SDK (VK, Яндекс) требуют config-плагинов для репозиториев и manifest-placeholders — иначе prebuild --clean ломает сборку"
metadata:
  type: project
---

`android/` в `.gitignore` и **`npx expo prebuild --clean` стирает все ручные правки** в нём. Поэтому любая настройка нативных SDK, которая раньше дописывалась руками в `android/`, ДОЛЖНА жить в config-плагинах (`plugins/*.js`, зарегистрированы в `app.json`), иначе первый же `--clean` молча ломает сборку.

**Why:** Однажды понадобился `prebuild --clean` — он снёс ручные правки в `android/`, из-за чего отвалились нативные SDK: не резолвились maven-зависимости и падал manifest merger на placeholder'ах. Всё, что живёт в `android/`, обязано воспроизводиться плагином.

**Почему модульные `repositories {}` не помогают:** под RN settings-plugin (`com.facebook.react.settings`) действует централизованный резолвинг — `repositories {}` внутри `modules/*/android/build.gradle` ИГНОРИРУЮТСЯ. Репозитории нужно класть в корневой `android/build.gradle` → `allprojects.repositories`.

**Существующие плагины (`plugins/*.js`, регистрируются в `app.json`):**
- `plugins/with-native-maven-repos.js` (`withProjectBuildGradle`) — добавляет в `allprojects.repositories` VK artifactory (3 URL). Яндекс ID сюда не нужен: `com.yandex.android:authsdk` лежит в mavenCentral.
- `plugins/with-vk-manifest-placeholders.js` (`withAppBuildGradle`) — добавляет в `defaultConfig.manifestPlaceholders`: `VKIDClientID=54615454`, `VKIDRedirectHost=vk.com`, `VKIDRedirectScheme=vk54615454`, `VKIDClientSecret` (читается из gradle-проперти, НЕ хардкод).
- `plugins/with-yandex-manifest-placeholders.js` — `YANDEX_CLIENT_ID` в `defaultConfig.manifestPlaceholders` (client_id публичный, лежит в плагине).
- `plugins/with-tg-queries.js` — `<queries>` для схемы `tg` в манифесте (Android 11+ package visibility) — без этого `Linking.openURL('tg://...')` молча не срабатывает.
- `plugins/with-health-permissions.js` — `READ_STEPS` permission + Android-14 rationale `activity-alias`, см. [[feature-health-connect]].
- `plugins/with-signing-config.js` — release-подпись APK из `~/.gradle/gradle.properties` (`TAPA_STORE_FILE` и т.д.), фоллбэк на debug-подпись если свойств нет (CI/чужая машина).

**Секреты НЕ в гите — в `~/.gradle/gradle.properties` (глобально, вне репо):**
```
gpr.user=Saartr
gpr.key=<github PAT с read:packages>   # ⚠️ был засвечен в чате — отозвать/перевыпустить
VKIDClientSecret=<vk client secret>
```
Плагины читают их через `project.findProperty(...)`. На новой машине/CI эти строки надо добавить вручную.

**How to apply:** Новый нативный SDK с кастомным maven-репо или manifest-placeholder'ом → добавлять в соответствующий config-плагин, НЕ править `android/` руками. Секреты — в `~/.gradle/gradle.properties`, плагин читает через `findProperty`. Build-артефакты модулей игнорируются правилом `modules/*/android/build/` в `.gitignore`. См. [[feature-yandex-id]], [[feature-auth]], [[infra-dev-env]].