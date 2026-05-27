# Memory Index

- [iOS Build Plan](project_ios_plan.md) — EAS Build when Apple Developer Account obtained; Android-only until then
- [Auth Refactor → Telegram Login Widget](project_auth_refactor.md) — завершено: WebView+виджет на фронте, HMAC-верификация + аватары на бэке
- [Главный экран](project_main_screen.md) — реализован: шторка, аватар, имя с truncation, empty state, без таб-бара
- [SSH: редактирование файлов на сервере](feedback_ssh_file_edit.md) — только через scp (cat > локальный файл → Edit → scp обратно), никаких inline node/python по SSH
- [Figma TapaDS — источник правды](feedback_figma_source_of_truth.md) — иконки/цвета/компоненты/отступы только из Figma TapaDS, не придумывать самостоятельно
- [Стек проекта](project_stack.md) — Expo SDK 55, Express 5, postgres tag, PM2, grammy, BASE_URL, JWT TTL
- [Окружение разработки](project_dev_env.md) — IP компьютера/телефона, запуск dev-сервера, Android APK-сборка
- [База данных](project_database.md) — схема всех таблиц: users, groups, habits, habit_members, habit_logs, refresh_tokens
- [Деплой бэкенда](project_backend_deploy.md) — backend/ в репо, ручной деплой через `./deploy-backend.ps1` (нет автодеплоя)
