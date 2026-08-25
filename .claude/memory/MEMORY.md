# Memory Index

Схема имён: `rules_` — правила работы · `infra_` — стек/окружение/БД · `feature_` — фичи продукта · `ui_` — UI-паттерны · `backlog` — отложенное · `reference_` — внешние ресурсы.

## Правила работы

- [Git-процесс](rules_git_workflow.md) — коммитить/пушить только по явной просьбе, сообщения по-русски; перед коммитом актуализировать память
- [Деплой бэкенда](rules_backend_deploy.md) — серверный код правится только локально в `backend/`, ручной деплой `./deploy-backend.ps1` (нет автодеплоя); прямой SSH — только логи/рестарт/.env
- [Figma — источник правды](rules_figma.md) — иконки/цвета/компоненты/отступы только из TapaDS; в SVG `fill="currentColor"` можно править без спроса
- [Дизайн-система](rules_design_system.md) — не хардкодить цвета (colors.ts/useColors), готовые компоненты вместо примитивов; карточки/подложки без теней
- [Naming: Haba→Тапа](rules_naming.md) — в UI «Тапа», системные идентификаторы (scheme/package/SecureStore keys) остаются haba

## Инфраструктура

- [Стек проекта](infra_stack.md) — Expo SDK 55, Express 5, postgres tag, PM2, grammy, BASE_URL, JWT TTL
- [Окружение разработки](infra_dev_env.md) — IP компьютера/телефона, запуск dev-сервера, Android APK-сборка
- [База данных](infra_database.md) — схема всех таблиц: users, groups, habits (+кастомные/pullups колонки), habit_members, habit_logs, push_tokens, refresh_tokens
- [Android нативные SDK](infra_android_native.md) — maven-репо + manifest-placeholders через config-плагины, т.к. `prebuild --clean` стирает `android/`; секреты в `~/.gradle/gradle.properties`
- [iOS план](infra_ios_plan.md) — EAS Build когда появится Apple Developer Account; до тех пор Android-only

## Фичи

- [Авторизация](feature_auth.md) — Яндекс ID + VK ID (оба нативные Expo Modules); Telegram-вход удалён по 199-ФЗ; фикс гонки /auth/refresh; имя не затирается при повторном логине; аватар с любого привязанного провайдера + POST /auth/refresh-avatar
- [Яндекс ID](feature_yandex_id.md) — authsdk 3.1.3 из mavenCentral, ActivityResultContract, проверка client_id на сервере, yandex_avatar_id в БД
- [Telegram Login](feature_telegram_login.md) — ⛔ УДАЛЁН (2026-08-25), файл оставлен как история: запрет авторизации через иностранные сервисы, 199-ФЗ
- [Health Connect](feature_health_connect.md) — ✅ работает на debug; причина бывшего пустого requestPermission — отсутствие Android-14 rationale activity-alias в манифесте, НЕ верификация
- [Health Sync WorkManager](feature_health_sync.md) — ✅ реализовано: Expo Module health-sync, CoroutineWorker, refreshToken в SharedPreferences, scheduleSync/cancelSync
- [Push-уведомления](feature_push.md) — ✅ реализовано: FCM HTTP v1 напрямую (без Expo), глобальный + per-habit тогглы, 5 типов пушей
- [Главный экран](feature_main_screen.md) — параллакс шапки при скролле, empty state на Toolbar, фон neutral[75], иллюстрации из Figma (welcome/error/splash/success)
- [Цель «Подтягивания»](feature_pullups.md) — ✅ реализовано: колонки в habits + сохранённый план, формула прогрессии, Multiselect, календарь Неделя/Месяц, тап по дате → модалка плана, solo-only
- [Групповая count-цель](feature_group_count_goal.md) — безлимитная (goal_value NULL), пуш на каждую запись, entry_totals/«Общая статистика», кнопка +1, календарь без красного
- [Типы целей: тоггл «С целью/Без цели»](feature_habit_goal_types.md) — 🚧 на ревью: solo count без порога, переделка детальных экранов Да/Нет и Количество-с-целью (Неделя/Месяц, карточки, CTA) по макетам

## UI-паттерны

- [Модалки и меню](ui_modals.md) — BottomSheet, ConfirmModal/useConfirm, DropdownPopover; единая анимация, elevation:0 на Android
- [Клавиатура на Android](ui_keyboard.md) — edge-to-edge не ресайзит окно: useKeyboardPadding + «парящая» кнопка на экранах форм

## Бэклог

- [Отложенное и известные баги](backlog.md) — expo-clipboard (нужен prebuild); карточки «Шаги» показывают стрик

## Справочники

- [Figma MCP](reference_figma_mcp.md) — как поднять Dev Mode MCP + curl-обход, get_design_context/screenshot, node-id формат
