---
name: release
description: Собрать release Android — APK для сайта и RuStore и AAB для Google Play из одного запуска Gradle, выложить APK на apptapa.ru — с поднятием versionCode, проверкой подписи и разрешений обоих файлов и сверкой того, что реально лежит на сайте. Запускается только человеком.
disable-model-invocation: true
---

# Выкладка релиза Android

Полный цикл: поднять номер сборки → собрать APK и AAB → проверить оба → выложить APK →
убедиться, что на сайте лежит именно он → передать AAB человеку для Google Play. Правила,
стоящие за этим, — в `.claude/memory/rules_release_publish.md`.

Зачем два файла: сайт и RuStore принимают APK, а **Google Play — только AAB**. Собираются они
одним запуском Gradle, поэтому во все каналы уходит один и тот же код с одним номером.

⚠️ **Выкладка публичная.** Файл сразу становится доступен всем по ссылке с `apptapa.ru`.
Перед шагом 6 остановиться и дождаться подтверждения человека.

## 0. Что должно быть на машине

Скилл рассчитан на любую машину разработчика, путей к чьему-то профилю здесь нет. Но три
вещи обязаны быть настроены локально, иначе релиз соберётся неправильно или не выложится:

- **Релизный keystore и пароли** в `~/.gradle/gradle.properties`: `TAPA_STORE_FILE`,
  `TAPA_STORE_PASSWORD`, `TAPA_KEY_ALIAS`, `TAPA_KEY_PASSWORD`. Без них
  `plugins/with-signing-config.js` **молча** подписывает отладочным ключом — сборка соберётся,
  но будет негодной. Именно от этого страхует проверка подписи на шаге 5.
- **`VKIDClientSecret`** там же — иначе вход через VK не работает в рантайме.
- **SSH-алиас `Tapa`** в `~/.ssh/config` — им пользуется `upload-apk.ps1`.

Проверить разом:

```bash
grep -c "TAPA_STORE_FILE\|VKIDClientSecret" "$HOME/.gradle/gradle.properties"   # ожидается 2
grep -A2 "Host Tapa" "$HOME/.ssh/config" | head -3
```

## 1. Проверить, что можно собирать

```bash
cd "$(git rev-parse --show-toplevel)"
git status --short                                 # дерево должно быть чистым
git log --oneline -1                               # и запушено
curl -s https://apptapa.ru/download/latest.json    # что сейчас на сайте
```

Если есть незакоммиченное — спросить, включать ли это в релиз. Собирать из грязного дерева
нельзя: потом не восстановить, что именно ушло пользователям.

## 2. Поднять versionCode

Живёт в `app.json` → `expo.android.versionCode`. **Не в `android/app/build.gradle`** — папка
`android/` генерируется prebuild'ом, правки в ней затираются.

Номер общий для всех каналов — сайта, RuStore и Google Play: Android ставит обновление поверх,
только если номер больше. Новый номер должен быть больше всех, что уже где-либо лежат (в памяти
записано, какой номер где). RuStore и Play не принимают повторную загрузку с тем же номером.

## 3. Пересобрать нативный проект

```bash
npx expo prebuild --platform android
SDK_DIR=$(cygpath -m "${ANDROID_HOME:-$LOCALAPPDATA/Android/Sdk}")
printf 'sdk.dir=%s\n' "$SDK_DIR" > android/local.properties
cat android/local.properties    # слэши должны быть прямыми
```

⚠️ `local.properties` пересоздавать **обязательно** и **только с прямыми слэшами**: prebuild
её не создаёт, а с обратными Gradle падает на `Invalid file path` — в `.properties` бэкслэш
это escape-символ. `cygpath -m` приводит windows-путь к прямым слэшам — переменные
окружения Windows приходят в bash с обратными, поэтому просто подставить их нельзя.

Если prebuild останавливается на вопросе про незакоммиченные файлы (поднятый `versionCode`
ещё не в git) — запускать с `EXPO_NO_GIT_STATUS=1`.

## 4. Собрать

Через инструмент PowerShell (не Bash — там не подхватываются переменные окружения Gradle):

```powershell
cd "$(git rev-parse --show-toplevel)\android"
if (-not $env:JAVA_HOME)   { $env:JAVA_HOME   = "C:\Program Files\Android\Android Studio\jbr" }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }
.\gradlew assembleRelease bundleRelease
```

Если своя JDK или SDK лежат в другом месте — задать `JAVA_HOME`/`ANDROID_HOME` в системе,
скилл их не перетирает.

Сборка после свежего prebuild идёт 3–7 минут — её удобно запускать в фоне. **Не оборачивать в
`Start-Process -Wait`**: PowerShell ждёт и дочерние процессы, а демон Gradle после сборки
остаётся жить — команда не вернётся никогда, хотя сборка давно готова.

Если упало на первом прогоне — повторить один раз: сборка иногда падает плавающе (кончается
metaspace у демона Gradle). Если упало дважды — разбираться, а не повторять.

## 5. Проверить собранное

```bash
cd "$(git rev-parse --show-toplevel)"
SDK_DIR=$(cygpath -m "${ANDROID_HOME:-$LOCALAPPDATA/Android/Sdk}")
AAPT=$(ls -d "$SDK_DIR"/build-tools/*/aapt2.exe | tail -1)
AS=$(ls -d "$SDK_DIR"/build-tools/*/apksigner.bat | tail -1)
export JAVA_HOME="${JAVA_HOME:-C:/Program Files/Android/Android Studio/jbr}"
JBR=$(cygpath -m "$JAVA_HOME")
APK=android/app/build/outputs/apk/release/app-release.apk
AAB=android/app/build/outputs/bundle/release/app-release.aab
AAB_MANIFEST=android/app/build/intermediates/bundle_manifest/release/processApplicationManifestReleaseForBundle/AndroidManifest.xml

# APK
"$AAPT" dump badging $APK | head -1        # versionCode тот, что ставили?
"$AS" verify --print-certs $APK | grep -i "SHA-256"
"$AAPT" dump permissions $APK | grep -iE "SYSTEM_ALERT_WINDOW|EXTERNAL_STORAGE"

# AAB
ls -la $APK $AAB                                               # оба свежие, из этого запуска?
"$JBR/bin/keytool" -printcert -jarfile $AAB | grep -i sha256   # та же релизная подпись
"$JBR/bin/jarsigner" -verify $AAB | grep -i verified           # jar verified.
grep -oE 'android:versionCode="[0-9]+"' $AAB_MANIFEST          # тот же versionCode
unzip -p $AAB base/manifest/AndroidManifest.xml | grep -a -ciE "SYSTEM_ALERT_WINDOW|EXTERNAL_STORAGE"   # 0
```

- **Подпись обязана быть релизной** у обоих файлов: `5e3a2c58ea0f49336025a8b796d997f57a9534c3cae69d876a876e2f52d216aa`
  (`keytool` печатает её заглавными через двоеточие: `5E:3A:2C:58:…:16:AA`). Любая другая (в
  частности отладочная `fac61745…`) означает, что ключа на машине нет и сработал фоллбэк —
  такой APK не встанет поверх установленного у пользователей, а AAB Google Play не примет.
- **Спорных разрешений быть не должно**: `SYSTEM_ALERT_WINDOW` и `READ/WRITE_EXTERNAL_STORAGE`
  убраны через `android.blockedPermissions`. Если появились — проверить `app.json`, RuStore
  их отмечает при релизе.

Почему AAB проверяется иначе: `aapt2` его не читает («could not identify format of APK»), а
`bundletool` в SDK не входит. Поэтому номер берётся из манифеста, который Gradle упаковал в
бандл (если после обновления AGP путь сменится — `find android/app/build/intermediates -path
"*bundle_manifest*release*" -name AndroidManifest.xml`). Манифест внутри самого `.aab` в
protobuf, но имена разрешений лежат в нём строками — `grep -a` их находит. Предупреждение
`jarsigner` про `BUNDLE-METADATA/…debugsymbols… is not signed in JarInputStream` обычное для
AAB и на проверку не влияет.

## 6. Выложить APK на сайт

Здесь остановиться и подтвердить у человека.

```powershell
cd "$(git rev-parse --show-toplevel)"; .\upload-apk.ps1
```

Скрипт сам сверяет sha с тем, что на сервере, и не гоняет 100 МБ повторно; `latest.json`
пишет последним, чтобы при обрыве страница показывала предыдущую сборку.

## 7. Убедиться, что выложилось именно оно

**Не верить сообщению «Готово».** Однажды выкладка прошла наполовину: файл залился во
временное имя, переименование не выполнилось, а метаданные обновились — сайт обещал новую
сборку и отдавал старую.

```bash
curl -s https://apptapa.ru/download/latest.json
curl -s https://apptapa.ru/download/tapa-latest.apk -o "$TEMP/dl.apk"
"$AAPT" dump badging "$TEMP/dl.apk" | head -1     # versionCode совпадает?
sha256sum "$TEMP/dl.apk" | cut -d' ' -f1
sha256sum android/app/build/outputs/apk/release/app-release.apk | cut -d' ' -f1
rm -f "$TEMP/dl.apk"
```

Хеши обязаны совпасть побайтово.

## 8. Передать AAB для Google Play

Загружает человек, вручную: Play Console → выпуск (тестирование или рабочая версия) → создать
выпуск → загрузить `android/app/build/outputs/bundle/release/app-release.aab`. Сообщить ему
путь, versionCode и размер файла.

⚠️ Перед **первой** загрузкой напомнить про Play App Signing: если Google переподписывает сборки
своим ключом, версия из Play не встанет поверх версий с сайта и RuStore, а отпечаток ключа
Google нужно добавить в консоли Яндекса и VK — иначе вход через них не пройдёт. Подробнее — в
`rules_release_publish.md`.

## 9. Закоммитить

Поднятый `versionCode` — в git, сообщение по-русски (см. `rules_git_workflow`). Заодно
проверить, не устарела ли память: в `rules_release_publish.md` записано, какой номер где
лежит (сайт, RuStore, Google Play) — его надо обновить.

## Чего этот скилл НЕ делает

- Не отправляет в RuStore и Google Play — это ручные действия человека в консолях.
- Не проверяет работоспособность сборки. Прогон по устройству (вход обоими провайдерами,
  пуши, шаги, экраны) — отдельная задача, и её стоит сделать до выкладки, а не после:
  в RuStore уже есть релиз, у людей на руках рабочая версия.
