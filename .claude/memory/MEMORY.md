# Memory Index

- [iOS Build Plan](project_ios_plan.md) — EAS Build when Apple Developer Account obtained; Android-only until then
- [Авторизация](project_auth_refactor.md) — два способа: Telegram (браузер + deeplink) и VK ID (нативный SDK 2.6.0, Expo Module, New Arch)
- [Health Connect](project_health_connect.md) — реализовано, заблокировано Google Play верификацией; разблокируется после регистрации в Play Console ($25)
- [Главный экран](project_main_screen.md) — реализован: шторка, аватар, имя с truncation, empty state, без таб-бара
- [SSH: редактирование файлов на сервере](feedback_ssh_file_edit.md) — серверный код правится локально в `backend/` и деплоится через `./deploy-backend.ps1`, никакой прямой правки на сервере
- [Figma TapaDS — источник правды](feedback_figma_source_of_truth.md) — иконки/цвета/компоненты/отступы только из Figma TapaDS, не придумывать самостоятельно
- [Стек проекта](project_stack.md) — Expo SDK 55, Express 5, postgres tag, PM2, grammy, BASE_URL, JWT TTL
- [Окружение разработки](project_dev_env.md) — IP компьютера/телефона, запуск dev-сервера, Android APK-сборка
- [База данных](project_database.md) — схема всех таблиц: users, groups, habits, habit_members, habit_logs, refresh_tokens
- [Деплой бэкенда](project_backend_deploy.md) — backend/ в репо, ручной деплой через `./deploy-backend.ps1` (нет автодеплоя)
