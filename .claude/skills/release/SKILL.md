---
name: release
description: Собрать release APK для Android и выложить его на apptapa.ru — с поднятием versionCode, проверкой подписи и разрешений, и сверкой того, что реально лежит на сайте. Запускается только человеком.
disable-model-invocation: true
---

# Выкладка релиза Android

Полный цикл: поднять номер сборки → собрать → проверить → выложить → убедиться, что на
сайте лежит именно она. Правила, стоящие за этим, — в `.claude/memory/rules_release_publish.md`.

⚠️ **Выкладка публичная.** Файл сразу становится доступен всем по ссылке с `apptapa.ru`.
Перед шагом 6 остановиться и дождаться подтверждения человека.

## 1. Проверить, что можно собирать

```bash
git status --short          # дерево должно быть чистым
git log --oneline -1        # и запушено
curl -s https://apptapa.ru/download/latest.json   # что сейчас на сайте
```

Если есть незакоммиченное — спросить, включать ли это в релиз. Собирать из грязного дерева
нельзя: потом не восстановить, что именно ушло пользователям.

## 2. Поднять versionCode

Живёт в `app.json` → `expo.android.versionCode`. **Не в `android/app/build.gradle`** — папка
`android/` генерируется prebuild'ом, правки в ней затираются.

Новый номер должен быть больше и того, что на сайте, и того, что в RuStore (в памяти записано,
что там лежит). RuStore не принимает повторную загрузку с тем же номером.

## 3. Пересобрать нативный проект

```bash
npx expo prebuild --platform android
printf 'sdk.dir=C:/Users/Saartr/AppData/Local/Android/Sdk\n' > android/local.properties
```

⚠️ `local.properties` пересоздавать **обязательно** и **только с прямыми слэшами**: prebuild
её не создаёт, а с обратными Gradle падает на `Invalid file path` — в `.properties` бэкслэш
это escape-символ.

## 4. Собрать

Через инструмент PowerShell (не Bash — там не подхватываются переменные окружения Gradle):

```powershell
cd C:\haba\android; $env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"; $env:ANDROID_HOME="C:\Users\Saartr\AppData\Local\Android\Sdk"; .\gradlew assembleRelease
```

Если упало на первом прогоне — повторить один раз: сборка иногда падает плавающе (кончается
metaspace у демона Gradle). Если упало дважды — разбираться, а не повторять.

## 5. Проверить собранное

```bash
SDK="C:/Users/Saartr/AppData/Local/Android/Sdk"
AAPT=$(ls -d "$SDK"/build-tools/*/aapt2.exe | tail -1)
AS=$(ls -d "$SDK"/build-tools/*/apksigner.bat | tail -1)
export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
APK=android/app/build/outputs/apk/release/app-release.apk

"$AAPT" dump badging $APK | head -1        # versionCode тот, что ставили?
"$AS" verify --print-certs $APK | grep -i "SHA-256"
"$AAPT" dump permissions $APK | grep -iE "SYSTEM_ALERT_WINDOW|EXTERNAL_STORAGE"
```

- **Подпись обязана быть релизной**: `5e3a2c58ea0f49336025a8b796d997f57a9534c3cae69d876a876e2f52d216aa`.
  Отладочная (`fac61745…`) означает, что сборка ушла не с тем ключом — не выкладывать.
- **Спорных разрешений быть не должно**: `SYSTEM_ALERT_WINDOW` и `READ/WRITE_EXTERNAL_STORAGE`
  убраны через `android.blockedPermissions`. Если появились — проверить `app.json`, RuStore
  их отмечает при релизе.

## 6. Выложить

Здесь остановиться и подтвердить у человека.

```powershell
cd C:\haba; .\upload-apk.ps1
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

## 8. Закоммитить

Поднятый `versionCode` — в git, сообщение по-русски (см. `rules_git_workflow`). Заодно
проверить, не устарела ли память: в `rules_release_publish.md` записано, какой номер где
лежит — его надо обновить.

## Чего этот скилл НЕ делает

- Не отправляет в RuStore — это ручное действие человека в консоли.
- Не проверяет работоспособность сборки. Прогон по устройству (вход обоими провайдерами,
  пуши, шаги, экраны) — отдельная задача, и её стоит сделать до выкладки, а не после:
  в RuStore уже есть релиз, у людей на руках рабочая версия.
