---
name: project-pending-features
description: Функциональность, которую нужно реализовать позже (решение принято, реализация отложена)
metadata:
  type: project
---

## Отложенные фичи (решения приняты)

### expo-clipboard — подключить при следующей пересборке APK
`Clipboard` из `react-native` deprecated. `expo-clipboard` установлен (`npm install` выполнен), но нативный модуль `ExpoClipboard` требует `prebuild`.
**Что нужно:** при следующем `npx expo prebuild --platform android --clean`:
1. В `app/(tabs)/habit/[id].tsx` заменить `import { Clipboard } from 'react-native'` → `import * as Clipboard from 'expo-clipboard'`
2. Заменить `Clipboard.setString(...)` → `Clipboard.setStringAsync(...)`
**Файл:** `app/(tabs)/habit/[id].tsx:14` и `:747` (номера строк сдвигаются по мере правок файла — искать по `import { Clipboard } from 'react-native'` и `Clipboard.setString`)

