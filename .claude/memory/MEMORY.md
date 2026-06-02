# Memory Index

- [iOS Build Plan](project_ios_plan.md) — EAS Build when Apple Developer Account obtained; Android-only until then
- [Авторизация](project_auth_refactor.md) — два способа: Telegram (браузер + deeplink) и VK ID (нативный SDK 2.6.0, Expo Module, New Arch)
- [Telegram OIDC / Native Login](project_telegram_oidc.md) — ✅ работает + телефон (scope=phone). SDK = браузерный OIDC через oauth.telegram.org. 🔴 требует VPN без split-tunnel; ⚠️ release-сборка требует release SHA-256 в BotFather
- [Android config-плагины](project_android_config_plugins.md) — нативные SDK (VK/TG): maven-репо + manifest-placeholders через config-плагины, т.к. `prebuild --clean` стирает `android/`. Секреты в `~/.gradle/gradle.properties`
- [Health Connect](project_health_connect.md) — ✅ работает на debug; причина бывшего пустого requestPermission — отсутствие Android-14 rationale activity-alias в манифесте, НЕ верификация
- [Главный экран](project_main_screen.md) — реализован: шторка, аватар, имя с truncation, empty state, без таб-бара
- [UI: модалки и меню](project_ui_modals.md) — BottomSheet, ConfirmModal/useConfirm, DropdownPopover; единая анимация, elevation:0 на Android
- [Figma MCP](reference_figma_mcp.md) — как поднять Dev Mode MCP + curl-обход, get_design_context/screenshot, node-id формат
- [SSH: редактирование файлов на сервере](feedback_ssh_file_edit.md) — серверный код правится локально в `backend/` и деплоится через `./deploy-backend.ps1`, никакой прямой правки на сервере
- [Figma TapaDS — источник правды](feedback_figma_source_of_truth.md) — иконки/цвета/компоненты/отступы только из Figma TapaDS, не придумывать самостоятельно
- [Иконки: fill=currentColor](feedback_icons_currentcolor.md) — менять fill на currentColor в SVG можно без спроса; fill="none" на <svg> не трогать
- [Стек проекта](project_stack.md) — Expo SDK 55, Express 5, postgres tag, PM2, grammy, BASE_URL, JWT TTL
- [Окружение разработки](project_dev_env.md) — IP компьютера/телефона, запуск dev-сервера, Android APK-сборка
- [База данных](project_database.md) — схема всех таблиц: users, groups, habits, habit_members, habit_logs, refresh_tokens
- [Деплой бэкенда](project_backend_deploy.md) — backend/ в репо, ручной деплой через `./deploy-backend.ps1` (нет автодеплоя)
- [Git коммиты](feedback_git_commits.md) — коммитить и пушить только по явной просьбе, не автоматически
