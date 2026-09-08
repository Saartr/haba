---
name: infra-sdk57-upgrade
description: "План обновления Expo SDK 55 → 57: что ломается, чего мы не касаемся, порядок и проверка Android"
metadata:
  type: project
---

Решение принято 2026-08-31. Повод: Expo Go поддерживает только последний SDK, на телефоне
уже 57 — без обновления iOS-разработку вести неудобно ([[infra-ios-plan]]). Попутно проект
перестаёт отставать: Expo собирает ограниченное число последних SDK.

## Целевая версия

**`expo@57.0.21`** (последняя на 2026-08-31), и **не ниже `57.0.9`**.

⚠️ У SDK 55 с Hermes V1, у всего SDK 56 и у 57 до `57.0.9` есть регрессия памяти при
использовании `react-native-worklets` / `react-native-reanimated` — а у нас есть оба.
Версию Hermes руками не переключать, это не поддерживается.

**SDK 56 пропускаем** — официальная рекомендация Expo: с 55 и ниже обновляться сразу на 57.
Но ломающие изменения 56 всё равно применятся, они ниже.

## Что реально ломается у нас

| Изменение | Где | Оценка |
|---|---|---|
| `expo-router` больше не зависит от React Navigation (SDK 56) | 2 файла: `useFocusEffect` из `@react-navigation/native` в `app/(tabs)/index.tsx` и `app/(tabs)/habit/[id].tsx` → `expo-router/react-navigation`, есть кодмод `npx expo-codemod sdk-56-expo-router-react-navigation-replace` | мелочь |
| `expo/fetch` становится глобальным `fetch` (SDK 56) | `lib/api.ts` — перепроверить авторизацию и рефреш токена | тест |
| Минимум iOS поднялся 15.1 → 16.4, Xcode 26.4 | сборку делают воркеры EAS, локально не касается | — |
| Hermes V1 по умолчанию | вся сборка | тест |
| TypeScript 6.0.3 | возможны новые ошибки типов | тест |
| RN 0.83.6 → 0.86 | три Kotlin-модуля на Expo Modules API, 5 config-плагинов, `react-native-health-connect` | главный риск |

**Нас НЕ касается** (проверено `grep`, 0 использований): `expo-av`, `@expo/vector-icons`,
`expo-file-system`, `react-native-webview`, `expo-calendar`, `expo-contacts`,
`expo-media-library`. NativeWind остаётся на 4.2.6 (v5 ещё preview, peer-требование — только
`tailwindcss > 3.3.0`). React 19 уже стоит с SDK 55, миграция React 19 не нужна.

Node на машине v24 — выше требуемого 20.19.4.

## Порядок

1. `npx expo install expo@latest` → `npx expo install --fix`
   (отдельный `--fix` на SDK 55 делать НЕ нужно — всё равно прыгаем через версию)
2. `npx expo-doctor`
3. Кодмод для `@react-navigation`, убрать пакет из зависимостей
4. `npx tsc --noEmit`, починить типы
5. `npx expo prebuild --platform android --clean` (проект на CNG, `android/` и `ios/` в .gitignore)
   — после этого пересоздать `android/local.properties` с ПРЯМЫМИ слэшами, см. [[infra-dev-env]]
6. Сборка debug APK и **ручной прогон по Android**: вход VK, вход Яндекс, пуши, импорт шагов,
   фоновый синк, все экраны, календари
7. Пересобрать и перевыложить **веб-версию**, проверить вход через Яндекс там
8. `versionCode 3`, release APK, `./upload-apk.ps1` ([[rules-release-publish]])

## Почему прогон по Android обязателен

В RuStore уже опубликован релиз с versionCode 2, у людей на руках рабочая версия. Обновление
SDK меняет весь нативный стек, поэтому проверять надо до выкладки, а не после.

## Housekeeping (из гайда Expo)

- `AGENTS.md` ссылается на `docs.expo.dev/versions/v55.0.0/` — поднять до v57
- убрать из `package.json` неявные пакеты: `babel-preset-expo` (у нас есть), `@babel/core`,
  `expo-constants`; если `babel.config.js` содержит только пресет — удалить файл
- `newArchEnabled` в конфиге больше не нужен, это дефолт
- рассмотреть `experiments.reactCompiler: true` — в SDK 54+ считается стабильным
