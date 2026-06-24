---
name: project-dev-env
description: "Окружение разработки — устройства, IP, запуск dev-сервера, Android-сборка"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f334f79-b33a-4bdb-b852-d3bff627bebf
---

**Окружение:**
- ОС: Windows 11
- Телефон Android: CPH2745, IP `192.168.1.139`
- IP компьютера: `192.168.1.143`
- VPN: Amnezia — телефон в split-tunnel, трафик к нему идёт напрямую

**Запуск dev-сервера:**
```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.143"; npx expo start
# затем 'a' для Android
```

**Android-сборка (APK):**
```powershell
# Перед сборкой: секреты в %USERPROFILE%\.gradle\gradle.properties (вне репо):
#   gpr.user=<GitHub-логин>     — для GitHub Packages (Telegram SDK)
#   gpr.key=<PAT read:packages> — иначе build падает: "Username must not be null!"
#   VKIDClientSecret=<секрет>   — иначе VK-вход не работает в рантайме
# После prebuild --clean пересоздать android/local.properties: sdk.dir=<путь к Android SDK текущего пользователя>

# Первый раз — генерация нативной папки:
npx expo prebuild --platform android --clean
# android/ в .gitignore — генерируется локально. Текущая версия Gradle wrapper: 9.0.0
# (distributionUrl в android/gradle/wrapper/gradle-wrapper.properties)
# Обновление wrapper: ./gradlew wrapper --gradle-version 9.0.0 --distribution-type bin
# Если daemon падает с native OOM при первой сборке на новой версии Gradle — освободить RAM
# (закрыть эмулятор/Metro/Chrome), при необходимости rm -rf ~/.gradle/caches/<version> и повторить.

# Сборка и установка:
cd C:\haba\android
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME="C:\Users\Saartr\AppData\Local\Android\Sdk"
.\gradlew assembleDebug
adb install app\build\outputs\apk\debug\app-debug.apk
```
APK: `android/app/build/outputs/apk/debug/app-debug.apk`
Первая сборка ~7 минут, повторные 1-2 минуты.

**How to apply:** При любых задачах связанных с запуском/сборкой использовать эти конкретные IP и пути, не спрашивать у пользователя.
