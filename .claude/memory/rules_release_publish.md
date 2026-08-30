---
name: rules-release-publish
description: "Собрал release APK — сразу выложить на apptapa.ru через upload-apk.ps1; versionCode поднимать для каждой загрузки в RuStore"
metadata:
  type: feedback
---

## Собрал release APK — выложи его на сайт

После каждой сборки release APK сразу запускать `./upload-apk.ps1` из корня репо.
Отдельного разрешения на выкладку спрашивать не нужно — это часть сборки, а не
отдельное действие.

**Why:** страница-заглушка на `https://apptapa.ru/` — единственный канал раздачи
сборок (Play Store нет, RuStore на модерации). Если APK не выложить, на сайте
висит предыдущая сборка, а ссылка, которую пользователь кому-то отправил, тихо
отдаёт старую версию. Пользователь попросил это правило явно (2026-08-30).

**How to apply:**
1. `cd android && ./gradlew assembleRelease` (переменные окружения — см. [[infra-dev-env]])
2. `./upload-apk.ps1` — заливает во временное имя, потом `mv`, затем пишет
   `latest.json`; страница подхватывает версию/размер/дату сама, HTML править не надо
3. Проверить `https://apptapa.ru/download/latest.json` — там должен быть свежий sha256

Страница лежит в git (`backend/public/index.html`) и деплоится обычным
`./deploy-backend.ps1` — см. [[rules-backend-deploy]]. Сам APK в git не хранится
(`backend/public/download/` в .gitignore).

## versionCode поднимать при каждой загрузке в стор

`versionCode` живёт в `app.json` (`expo.android.versionCode`), НЕ в
`android/app/build.gradle` — папка `android/` генерируется prebuild'ом, правки в
ней затираются. RuStore не принимает повторную загрузку с тем же номером.
Текущее значение: 2 (2026-08-30).

## Лишние разрешения в манифесте

RuStore при релизе отмечает чувствительные разрешения. `SYSTEM_ALERT_WINDOW` и
`READ/WRITE_EXTERNAL_STORAGE` приходят не из библиотек, а из шаблона манифеста
самого Expo (проверено отчётом мерджера: `manifest-merger-release-report.txt`),
и в release-сборке они ровно те же, что в debug — это НЕ признак того, что
собрали не ту сборку. Убраны через `android.blockedPermissions` в `app.json`.
Если появится новое незнакомое разрешение — сначала смотреть отчёт мерджера,
он называет файл-источник.
