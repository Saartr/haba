---
name: project-backend-deploy
description: "Бэкенд в репозитории (backend/), деплой ручным скриптом deploy-backend.ps1"
metadata:
  type: project
---

Бэкенд живёт в `backend/` в репозитории `Saartr/haba`. На сервере склонирован в `/var/www/haba`, PM2-процесс `step-bot` запускается из `/var/www/haba/backend` (`pm2 start npm --name step-bot --cwd /var/www/haba/backend -- start`).

**Деплой — ручной**, без GitHub Actions. Скрипт `deploy-backend.ps1` в корне репо.

**Why:** Соло-разработчик, один сервер. Автодеплой добавляет риск сломать прод неожиданным пушем; ручной запуск даёт полный контроль и видимость логов в реальном времени. Если потом понадобится — Actions добавляются за 10 минут.

**How to apply:**
- После пуша backend-изменений в `main` запустить из PowerShell в `c:\haba`: `./deploy-backend.ps1`
- Скрипт делает: `ssh Haba` → `git pull --ff-only` → `npm install --omit=dev` → `pm2 restart step-bot` → `pm2 list`
- Если что-то пошло не так — `ssh Haba 'pm2 logs step-bot --lines 50 --nostream'`
- Старая папка `/var/www/step-bot` оставлена как бэкап. Удалить через 1-2 дня после успешной работы новой.
- `.env` и `public/avatars/` НЕ в git (исключены через `.gitignore`). Хранятся только на сервере в `/var/www/haba/backend/`.

Ветки:
- `main` — стабильная версия, деплоится на прод вручную
- `dev` — рабочая ветка для разработки. Push в dev НЕ деплоится автоматически. Когда готово — мерж в `main` + запуск скрипта.
