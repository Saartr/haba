---
name: feedback-ssh-file-edit
description: "Серверные файлы редактируются локально в backend/ + ./deploy-backend.ps1, не через scp"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 6f334f79-b33a-4bdb-b852-d3bff627bebf
---

Никогда не редактировать файлы напрямую на сервере. Бэкенд теперь в репозитории — все правки делаются локально в `backend/`, коммитятся в `main`, деплоятся через `./deploy-backend.ps1`.

**Why:** Раньше файлы правились scp туда-обратно (`cat > local → Edit → scp back`), а ещё раньше — inline через `ssh ... "node -e ..."` (последний способ ломался на template literals и SQL-запросах из-за shell-экранирования). После переноса в `backend/` правки на сервере = расхождение с git и потеря работы при следующем `git pull` (через скрипт деплоя).

**How to apply:**
1. Найти и отредактировать файл локально: `backend/src/...` (через Edit, не scp)
2. Закоммитить и запушить в `main`: `git add backend/... && git commit -m '...' && git push origin main`
3. Запустить деплой: `./deploy-backend.ps1` (из PowerShell в `c:\haba`)
4. Проверить логи если что-то сломалось: `ssh Haba 'pm2 logs step-bot --lines 50 --nostream'`

**Когда нужен прямой SSH (без правки файлов):**
- Просмотр логов: `ssh Haba 'pm2 logs step-bot --lines 50 --nostream'`
- Проверка статуса: `ssh Haba 'pm2 list'`
- Перезапуск без деплоя (например, после правки `.env`): `ssh Haba 'pm2 restart step-bot'`
- Правка `.env` (он не в git): `scp Haba:/var/www/haba/backend/.env C:/tmp/.env` → Edit → `scp C:/tmp/.env Haba:/var/www/haba/backend/.env` → `ssh Haba 'pm2 restart step-bot'`

SSH-ключ: `~/.ssh/haba_deploy` (`C:\Users\Saartr\.ssh\haba_deploy`), сервер: `root@147.45.134.216`, алиас в `~/.ssh/config`: `ssh Haba` (без `-i`).
