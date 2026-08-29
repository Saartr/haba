---
name: rules-backend-deploy
description: "Бэкенд правится только локально в backend/ и деплоится через ./deploy-backend.ps1 (ручной, без автодеплоя); никакой прямой правки на сервере"
metadata:
  type: feedback
---

## Не редактировать файлы на сервере

Никогда не редактировать файлы напрямую на сервере. Бэкенд в репозитории — все правки делаются локально в `backend/`, коммитятся в `main`, деплоятся через `./deploy-backend.ps1`.

**Why:** Раньше файлы правились scp туда-обратно (`cat > local → Edit → scp back`), а ещё раньше — inline через `ssh ... "node -e ..."` (последний способ ломался на template literals и SQL-запросах из-за shell-экранирования). После переноса в `backend/` правки на сервере = расхождение с git и потеря работы при следующем `git pull` (через скрипт деплоя).

## Как деплоить

Бэкенд живёт в `backend/` в репозитории `Saartr/haba`. На сервере склонирован в `/var/www/haba`, PM2-процесс `step-bot` запускается из `/var/www/haba/backend`. **Деплой ручной**, без GitHub Actions (соло-разработчик, один сервер: автодеплой добавляет риск сломать прод неожиданным пушем; если понадобится — Actions добавляются за 10 минут).

1. Отредактировать файл локально: `backend/src/...` (через Edit, не scp)
2. Закоммитить и запушить в `main` (по явной просьбе — см. [[rules-git-workflow]])
3. Запустить деплой из PowerShell в `c:\haba`: `./deploy-backend.ps1` — скрипт делает `ssh Tapa` → `git pull --ff-only` → `npm install --omit=dev` → `pm2 restart step-bot` → `pm2 list`
4. Проверить логи если что-то сломалось: `ssh Tapa 'pm2 logs step-bot --lines 50 --nostream'`

`.env` и `public/avatars/` НЕ в git — хранятся только на сервере в `/var/www/haba/backend/`.

## Когда нужен прямой SSH (без правки файлов)

- Просмотр логов: `ssh Tapa 'pm2 logs step-bot --lines 50 --nostream'`
- Проверка статуса: `ssh Tapa 'pm2 list'`
- Перезапуск без деплоя (например, после правки `.env`): `ssh Tapa 'pm2 restart step-bot'`
- Правка `.env` (он не в git): `scp Haba:/var/www/haba/backend/.env C:/tmp/.env` → Edit → `scp C:/tmp/.env Haba:/var/www/haba/backend/.env` → `ssh Tapa 'pm2 restart step-bot'`

SSH-ключ: `~/.ssh/haba_deploy` (`C:\Users\Saartr\.ssh\haba_deploy`), сервер: `root@139.100.238.204`, алиас в `~/.ssh/config`: `ssh Tapa` (без `-i`).
