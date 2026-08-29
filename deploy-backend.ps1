# Deploy backend to server (manual trigger)
# Usage: ./deploy-backend.ps1
# Pulls latest from main on server, installs deps if changed, restarts PM2.
# Сервер: Tapa (139.100.238.204, Selectel СПб). Старый Haba выведен из эксплуатации 2026-08-29.

$ErrorActionPreference = 'Stop'

Write-Host "Deploying backend to apptapa.ru..." -ForegroundColor Cyan

ssh Tapa "cd /var/www/haba && git pull --ff-only && echo done_pull"
Write-Host "--- git pull done ---"

ssh Tapa "cd /var/www/haba/backend && npm install --omit=dev"
Write-Host "--- npm install done ---"

ssh Tapa "pm2 restart step-bot"
Write-Host "--- pm2 restarted ---"

ssh Tapa "pm2 list"

Write-Host "Done." -ForegroundColor Green
