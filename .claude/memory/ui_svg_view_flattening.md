---
name: ui-svg-view-flattening
description: "Краш Fabric «addViewAt: child already has a parent» — SVG-иконка внутри View с opacity: pressed"
metadata:
  type: feedback
---

## Симптом

Красный экран при уходе с экрана (чаще всего — нажатие «назад»):

```
addViewAt: failed to insert view [312] into parent [316] at index 0
The specified child already has a parent. You must call removeView() on the child's parent first.
```

JS-стека нет, только нативный — в Component Stack смотреть бесполезно.

## Причина

Паттерн «иконка в обёртке с прозрачностью по нажатию»:

```jsx
<Pressable ...>                                          ← 316
  {({ pressed }) => (
    <View style={{ ..., opacity: pressed ? 0.6 : 1 }}>   ← 314
      <ArrowBackIcon />                                   ← RNSVGSvgViewAndroid 312
    </View>
  )}
</Pressable>
```

При `opacity: 1` внутренний `View` несёт только раскладку, и React Native его **схлопывает**
(view flattening) — иконка становится прямым ребёнком `Pressable`. Нажатие даёт `opacity: 0.6`,
и `View` обязан материализоваться как настоящая native-view. Отпускание возвращает `1` — обёртка
схлопывается обратно, SVG переносится на уровень выше. Если в этот момент экран размонтируется
навигацией, операции идут вперемешку и Fabric получает вставку иконки к новому родителю раньше,
чем её убрали у старого.

`react-native-svg` особенно чувствителен: `RNSVGSvgViewAndroid` не переживает переподключение.

## Решение

`collapsable={false}` на обёртке — прямой запрет схлопывания. Раскладка не меняется.

```jsx
<View collapsable={false} style={{ ..., opacity: pressed ? 0.6 : 1 }}>
```

Применено (2026-08-25) в 11 местах: `NavigationBar` (общий для всех экранов — он и падал),
кнопки «ещё» на четырёх экранах целей, крестики в мастере кастомной цели, экраны документов,
витрина `dev.tsx`.

**Где проблемы нет:** когда `opacity` задан функцией стиля самого `Pressable`
(`style={({pressed}) => ({ opacity: ... })}`) — у него есть обработчики, он не схлопывается
никогда. Так сделано в `BottomSheet`, `Snackbar`, `Lists`, `Chip`, `DropdownMenu` — не трогать.

## Как диагностировать в следующий раз

1. `adb logcat -c`, воспроизвести, **не нажимать Reload** (перезагрузка убивает процесс с логами)
2. `adb logcat -d | grep "addViewAt: failed"` — взять id из сообщения
3. Рядом в логе `SurfaceMountingManager` печатает всё дерево: найти `<... id=X parentTag=Y />`
   для проблемной view и её родителей — по цепочке однозначно опознаётся место в JSX
4. Признак именно этого бага: вставляемая view — `RNSVGSvgViewAndroid`, а её текущий
   родитель сам лежит в целевом родителе (то есть промежуточный уровень исчезает)

**Why:** первый диагноз был неверным — грешил на ветки условия в `profile-settings`, добавил туда
`key` (оставлены, они защищают от того же класса проблемы при смене `hasYandex`/`hasVk`), но краш
остался. Помогло только чтение дерева из лога: структура `Pressable → View → SVG` совпала с
`NavigationBar` до идентификаторов. Не диагностировать этот краш по коду — читать дерево.
